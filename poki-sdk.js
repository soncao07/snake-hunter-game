/* === POKI SDK WRAPPER === */
class PokiSDK {
    constructor() {
        this.isReady = false;
        this.eventQueue = [];
        this.sessionStartTime = null;
        this.adCooldown = 0; // Prevent ad spam
        this.init();
    }

    async init() {
        try {
            // Wait for Poki SDK to load (with retry logic)
            // Poki SDK v2 loads as window.PokiSDK
            let retries = 3;
            while (retries > 0) {
                if (window.PokiSDK && typeof window.PokiSDK.init === 'function') {
                    try {
                        await window.PokiSDK.init();
                        this.isReady = true;
                        console.log('Poki SDK initialized successfully');
                        // Flush queued events
                        this.flushEventQueue();
                        // Track SDK initialization (but don't use trackEvent to avoid circular dependency)
                        if (window.PokiSDK && window.PokiSDK.customEvent) {
                            try {
                                window.PokiSDK.customEvent('sdk_initialized', { success: true });
                            } catch (e) {}
                        }
                        return;
                    } catch (initError) {
                        console.error('Poki SDK init() failed:', initError);
                        // Continue to retry
                    }
                }
                // Wait 500ms before retry
                await new Promise(resolve => setTimeout(resolve, 500));
                retries--;
            }
            console.warn('Poki SDK not available - running in dev mode');
        } catch (error) {
            console.error('Failed to initialize Poki SDK:', error);
        }
    }

    // Gameplay events
    gameplayStart() {
        try {
            if (this.isReady && window.PokiSDK) {
                window.PokiSDK.gameplayStart();
            }
        } catch (e) {
            console.error('gameplayStart error:', e);
        }
    }

    gameplayStop() {
        try {
            if (this.isReady && window.PokiSDK) {
                window.PokiSDK.gameplayStop();
            }
        } catch (e) {
            console.error('gameplayStop error:', e);
        }
    }

    // Commercial break (shown on game over, level complete)
    async showCommercialBreak() {
        // Check cooldown to prevent ad spam
        const now = Date.now();
        if (this.adCooldown > now) {
            console.log('Ad cooldown active, skipping commercial break');
            return false;
        }

        try {
            if (this.isReady && window.PokiSDK && typeof window.PokiSDK.commercialBreak === 'function') {
                this.gameplayStop();
                this.trackEvent('ad_commercial_break_start', { timestamp: now });
                
                try {
                    await window.PokiSDK.commercialBreak();
                    this.trackEvent('ad_commercial_break_complete', { success: true });
                    // Set cooldown: 30 seconds minimum between ads
                    this.adCooldown = now + 30000;
                } catch (adError) {
                    this.trackEvent('ad_commercial_break_complete', { success: false, error: adError.message });
                    console.warn('Commercial break failed:', adError);
                }
                
                this.gameplayStart();
                return true;
            } else {
                console.warn('Commercial break not available (SDK not ready or function missing)');
                this.trackEvent('ad_commercial_break_skipped', { reason: 'sdk_not_ready' });
            }
        } catch (e) {
            console.error('Commercial break error:', e);
            this.trackEvent('ad_commercial_break_error', { error: e.message });
            // Continue game even if ad fails
            this.gameplayStart();
        }
        return false;
    }

    // Rewarded break (watch ad to continue/revive)
    async showRewardedBreak() {
        try {
            if (this.isReady && window.PokiSDK && typeof window.PokiSDK.rewardedBreak === 'function') {
                this.gameplayStop();
                this.trackEvent('ad_rewarded_start', { timestamp: Date.now() });
                
                let result = false;
                try {
                    result = await window.PokiSDK.rewardedBreak();
                    if (result) {
                        this.trackEvent('ad_rewarded_complete', { success: true, watched: true });
                    } else {
                        this.trackEvent('ad_rewarded_complete', { success: true, watched: false, reason: 'user_skipped' });
                    }
                } catch (adError) {
                    this.trackEvent('ad_rewarded_complete', { success: false, error: adError.message });
                    console.warn('Rewarded break failed:', adError);
                    result = false;
                }
                
                this.gameplayStart();
                return result; // true if user watched ad
            } else {
                console.warn('Rewarded break not available (SDK not ready or function missing)');
                this.trackEvent('ad_rewarded_skipped', { reason: 'sdk_not_ready' });
                this.gameplayStart();
                return false;
            }
        } catch (e) {
            console.error('Rewarded break error:', e);
            this.trackEvent('ad_rewarded_error', { error: e.message });
            // Allow user to continue without watching if ad system fails
            this.gameplayStart();
            return false;
        }
    }

    // Analytics - Enhanced with structured events
    trackEvent(eventName, eventData = {}) {
        const eventPayload = {
            event: eventName,
            data: eventData,
            timestamp: Date.now()
        };

        if (this.isReady && window.PokiSDK && window.PokiSDK.customEvent) {
            try {
                window.PokiSDK.customEvent(eventName, eventData);
                console.log('Event tracked:', eventName, eventData);
            } catch (e) {
                console.error('Event tracking error:', e);
            }
        } else {
            // Queue event if SDK not ready yet
            this.eventQueue.push(eventPayload);
            console.log('Event queued (SDK not ready):', eventName);
        }
    }

    flushEventQueue() {
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            this.trackEvent(event.event, event.data);
        }
    }

    // Specific event helpers for better tracking
    trackGameStart(mode = 'campaign') {
        this.trackEvent('game_start', { mode });
    }

    trackGameOver(score, mode = 'campaign') {
        this.trackEvent('game_over', { score, mode });
    }

    trackTimeAttackScore(score, timeRemaining) {
        this.trackEvent('time_attack_score', { score, timeRemaining });
    }

    trackSessionStart() {
        this.sessionStartTime = Date.now();
        this.trackEvent('session_start', { 
            timestamp: this.sessionStartTime,
            referrer: document.referrer || 'direct'
        });
    }

    trackSessionEnd() {
        if (this.sessionStartTime) {
            const duration = Date.now() - this.sessionStartTime;
            this.trackEvent('session_end', { 
                duration: Math.floor(duration / 1000), // duration in seconds
                timestamp: Date.now()
            });
            this.sessionStartTime = null;
        }
    }

    // Track screen views (menu navigation)
    trackScreenView(screenName) {
        this.trackEvent('screen_view', { screen: screenName });
    }

    // Track mode selection
    trackModeSelection(mode) {
        this.trackEvent('mode_selected', { mode });
    }

    // Track score milestones
    trackScoreMilestone(score, milestone) {
        this.trackEvent('score_milestone', { score, milestone });
    }

    // Track combo achievements
    trackComboAchievement(combo) {
        this.trackEvent('combo_achievement', { combo });
    }

    // Track level start
    trackLevelStart(levelIndex, mode) {
        this.trackEvent('level_start', { level: levelIndex + 1, mode });
    }

    // Track high score achievement
    trackHighScore(score, previousHighScore) {
        this.trackEvent('high_score', { 
            score, 
            previousHighScore,
            improvement: score - previousHighScore
        });
    }
}

// Export for use in HTML
window.PokiSDKWrapper = PokiSDK;

