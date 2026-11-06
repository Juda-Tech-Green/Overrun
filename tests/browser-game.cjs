// Capture the real bootstrap without changing dev or production resources.
// Phaser is assigned by game/main before StartGame constructs its Game instance.
exports.prepareGamePage = async (page) => {
    await page.addInitScript(() => {
        let phaser;
        Object.defineProperty(window, 'Phaser', {
            configurable: true,
            get: () => phaser,
            set(value) {
                phaser = value;
                const boot = value.Game.prototype.boot;
                value.Game.prototype.boot = function (...args) {
                    window.__testGame = this;
                    return boot.apply(this, args);
                };
            },
        });
    });
};
