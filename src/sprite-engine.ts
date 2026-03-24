export type Frame = [number, number];

export type AnimationOptions = {
    loop?: boolean;
    flip?: boolean;
};

export class Animation {
    frames: Frame[];
    fps: number;
    options: AnimationOptions;

    constructor(frames: Frame[], fps: number, options: AnimationOptions = {}) {
        this.frames = frames;
        this.fps = fps;
        this.options = options;
    }
}

export type SpriteDefinition = {
    file: string;
    frameSize?: number;
    scale: number;
    animations: Record<string, Animation | Animation[]>;
};

export class SpriteEngine {
    private el: HTMLElement;
    private def: SpriteDefinition;
    private current?: Animation;
    private frameIndex = 0;
    private timer?: number;
    private spriteUrl: string;
    private flipped = false;
    private lastAnimationName?: string;
    private frameSize = 16;

    constructor(el: HTMLElement, def: SpriteDefinition, resourcePath: (file: string) => string) {
        this.el = el;
        this.def = def;
        this.spriteUrl = resourcePath(def.file);
    }

    async load() {
        this.el.setCssProps({
            "background-image": `url('${this.spriteUrl}')`,
        });
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load sprite ${this.def.file}`));
            img.src = this.spriteUrl;
        });
        const rows = this.getMaxRow() + 1;
        const inferred = rows > 0 ? Math.floor(img.naturalHeight / rows) : 16;
        this.frameSize = (this.def.frameSize && this.def.frameSize > 0) ? this.def.frameSize : inferred;
        this.el.setCssProps({
            "background-size": `${img.naturalWidth * this.def.scale}px ${img.naturalHeight * this.def.scale}px`,
        });
        this.setFrame([0, 0]);
    }

    play(name: string) {
        const animDef = this.def.animations[name];
        if (!animDef) return;
        const anim = Array.isArray(animDef) ? animDef[0] : animDef;
        if (!anim) return;
        this.stop();
        this.lastAnimationName = name;
        this.current = anim;
        this.frameIndex = 0;
        this.setFlip(Boolean(anim.options.flip));
        const firstFrame = anim.frames[this.frameIndex];
        if (firstFrame) this.setFrame(firstFrame);
        const interval = Math.max(16, Math.floor(1000 / anim.fps));
        this.timer = window.setInterval(() => {
            if (!this.current) return;
            this.frameIndex += 1;
            if (this.frameIndex >= this.current.frames.length) {
                if (this.current.options.loop === false) {
                    this.stop();
                    return;
                }
                this.frameIndex = 0;
            }
            const frame = this.current.frames[this.frameIndex];
            if (frame) this.setFrame(frame);
        }, interval);
    }

    stop() {
        if (this.timer) window.clearInterval(this.timer);
        this.timer = undefined;
    }

    getAnimationDurationMs(name: string) {
        const animDef = this.def.animations[name];
        if (!animDef) return null;
        const anim = Array.isArray(animDef) ? animDef[0] : animDef;
        if (!anim) return null;
        if (!anim.frames.length || anim.fps <= 0) return null;
        return Math.ceil((anim.frames.length / anim.fps) * 1000);
    }

    private setFlip(flip: boolean) {
        if (this.flipped === flip) return;
        this.flipped = flip;
        this.el.setCssProps({
            transform: flip ? "scaleX(-1)" : "scaleX(1)",
        });
    }

    setFrame(frame: Frame) {
        const x = -(frame[0] * this.frameSize) * this.def.scale;
        const y = -(frame[1] * this.frameSize) * this.def.scale;
        this.el.setCssProps({
            "background-position": `${x}px ${y}px`,
        });
    }

    getFrameSize() {
        return this.frameSize;
    }

    private getMaxRow() {
        let maxY = 0;
        for (const anim of Object.values(this.def.animations)) {
            const list = Array.isArray(anim) ? anim : [anim];
            for (const a of list) {
                for (const frame of a.frames) {
                    if (frame[1] > maxY) maxY = frame[1];
                }
            }
        }
        return maxY;
    }
}
