import { ItemView, WorkspaceLeaf } from "obsidian";
import { PetDefs } from "./pet-defs";
import { SpriteDefinition, SpriteEngine } from "./sprite-engine";
import { PLUGIN_ID } from "./constants";

export const VIEW_TYPE_STARDEW = "stardew-view";

export class StardewView extends ItemView {
    private animationsPaused = false;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_STARDEW;
    }

    getDisplayText(): string {
        return "Stardew Animals";
    }

    getIcon(): string {
        return "paw-print"; // Or some icon, maybe "leaf" or custom
    }

    onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('stardew-container');

        const header = container.createEl("h4", { cls: 'stardew-header', text: "Stardew Valley Animals" });

        // Create the farm area (fills remaining space)
        const farm = container.createDiv({ cls: "stardew-farm" });

        // Set background image from vault sprites folder
        const bgUrl = this.getPluginResourcePath('sprites/backgrounds/grass.png');
        farm.setCssProps({
            "background-image": `url('${bgUrl}')`,
        });

        // Add one of each animal
        for (const specie of Object.keys(this.ANIMAL_CONFIG)) {
            this.spawnPet(specie, specie);
        }

        // Start animations
        this.startAnimations();

        this.registerDomEvent(window, 'blur', () => this.pauseAnimations());
        this.registerDomEvent(window, 'focus', () => this.resumeAnimations());
        this.registerDomEvent(document, 'visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
            } else {
                this.resumeAnimations();
            }
        });
    }

    private readonly ANIMAL_CONFIG: Record<string, SpriteDefinition> = {
        chicken: PetDefs.CHICKEN,
        cow: PetDefs.COW,
        turtle: PetDefs.TURTLE,
        dino: PetDefs.DINO,
        duck: PetDefs.DUCK,
        raccoon: PetDefs.RACCOON,
        rabbit: PetDefs.RABBIT,
        parrot: PetDefs.PARROT,
        junimo: PetDefs.JUNIMO,
        dog: PetDefs.DOG,
        cat: PetDefs.CAT,
    };

    private animals: Array<{
        el: HTMLElement;
        config: SpriteDefinition;
        engine: SpriteEngine;
        x: number;
        y: number;
        state: 'idle' | 'walking';
        direction: 'down' | 'left' | 'right' | 'up';
        idleTimer?: number;
        actionTimer?: number;
        walkRaf?: number;
    }> = [];

    addAnimal(container: Element, sprite: string, id: string) {
        const config = this.ANIMAL_CONFIG[sprite];
        if (!config) {
            console.warn(`No sprite config found for ${sprite}`);
            return;
        }

        const animal = container.createDiv({ cls: "stardew-animal", attr: { id } });
        const engine = new SpriteEngine(animal, config, (file) => this.getPluginResourcePath(file));

        const farmEl = container as HTMLElement;
        const fallbackSize = (config.frameSize && config.frameSize > 0) ? config.frameSize : 16;
        const maxX = Math.max(0, farmEl.clientWidth - fallbackSize * config.scale);
        const maxY = Math.max(0, farmEl.clientHeight - fallbackSize * config.scale);
        const startX = Math.random() * maxX;
        const startY = Math.random() * maxY;

        animal.setCssProps({
            left: `${startX}px`,
            top: `${startY}px`,
            "--sprite-size": `${fallbackSize * config.scale}px`,
        });

        const animalState = {
            el: animal,
            config,
            engine,
            x: startX,
            y: startY,
            state: 'idle' as const,
            direction: 'down' as const,
        };

        this.animals.push(animalState);

        engine.load().then(() => {
            const size = engine.getFrameSize() * config.scale;
            animal.setCssProps({
                "--sprite-size": `${size}px`,
            });
            const maxLoadedX = Math.max(0, farmEl.clientWidth - size);
            const maxLoadedY = Math.max(0, farmEl.clientHeight - size);
            animalState.x = Math.max(0, Math.min(maxLoadedX, animalState.x));
            animalState.y = Math.max(0, Math.min(maxLoadedY, animalState.y));
            animal.setCssProps({
                left: `${animalState.x}px`,
                top: `${animalState.y}px`,
            });
        }).catch((err) => console.error(err));
    }

    spawnPet(name: string, specie: string, _color?: string) {
        const farm = this.contentEl.querySelector(".stardew-farm");
        if (!farm) return;
        const key = this.normalizeSpecieKey(specie);
        if (!key) {
            console.warn(`Unknown pet specie: ${specie}`);
            return;
        }
        const id = `${key}-${name}-${Date.now()}`;
        this.addAnimal(farm, key, id);
    }

    startAnimations() {
        this.animals.forEach(animal => this.startRest(animal));
    }

    private startRest(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        animalState.state = 'idle';
        animalState.engine.play("idle");
        const idleTime = Math.random() * 5000;
        animalState.idleTimer = window.setTimeout(() => this.startAction(animalState), idleTime);
    }

    private startAction(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        const doSleep = Math.random() < 0.3;
        if (doSleep) {
            this.startSleep(animalState);
        } else {
            this.startWalk(animalState);
        }
    }

    private startSleep(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        animalState.state = 'idle';
        animalState.engine.play("sleep");
        const sleepDuration = 3500 + Math.random() * 6500;
        animalState.actionTimer = window.setTimeout(() => this.startRest(animalState), sleepDuration);
    }

    private startWalk(animalState: typeof this.animals[number]) {
        if (this.animationsPaused) return;
        animalState.state = 'walking';
        const farm = this.contentEl.querySelector('.stardew-farm') as HTMLElement;
        if (!farm) return;
        const padding = animalState.engine.getFrameSize() * animalState.config.scale;
        const maxX = Math.max(0, farm.clientWidth - padding);
        const maxY = Math.max(0, farm.clientHeight - padding);

        const targetX = Math.random() * maxX;
        const targetY = Math.random() * maxY;

        const dx = targetX - animalState.x;
        const dy = targetY - animalState.y;

        const segments: Array<{
            dx: number;
            dy: number;
            direction: 'down' | 'left' | 'right' | 'up';
            distance: number;
        }> = [];

        const canX = Math.abs(dx) > 1;
        const canY = Math.abs(dy) > 1;
        if (canX && canY) {
            const useTwoSegments = Math.random() < 0.5;
            const firstHorizontal = Math.random() < 0.5;
            if (useTwoSegments) {
                if (firstHorizontal) {
                    segments.push({
                        dx,
                        dy: 0,
                        direction: dx > 0 ? 'right' : 'left',
                        distance: Math.abs(dx),
                    });
                    segments.push({
                        dx: 0,
                        dy,
                        direction: dy > 0 ? 'down' : 'up',
                        distance: Math.abs(dy),
                    });
                } else {
                    segments.push({
                        dx: 0,
                        dy,
                        direction: dy > 0 ? 'down' : 'up',
                        distance: Math.abs(dy),
                    });
                    segments.push({
                        dx,
                        dy: 0,
                        direction: dx > 0 ? 'right' : 'left',
                        distance: Math.abs(dx),
                    });
                }
            } else {
                const goHorizontal = Math.random() < 0.5;
                if (goHorizontal) {
                    segments.push({
                        dx,
                        dy: 0,
                        direction: dx > 0 ? 'right' : 'left',
                        distance: Math.abs(dx),
                    });
                } else {
                    segments.push({
                        dx: 0,
                        dy,
                        direction: dy > 0 ? 'down' : 'up',
                        distance: Math.abs(dy),
                    });
                }
            }
        } else if (canX) {
            segments.push({
                dx,
                dy: 0,
                direction: dx > 0 ? 'right' : 'left',
                distance: Math.abs(dx),
            });
        } else if (canY) {
            segments.push({
                dx: 0,
                dy,
                direction: dy > 0 ? 'down' : 'up',
                distance: Math.abs(dy),
            });
        }

        if (!segments.length) {
            this.startIdle(animalState);
            return;
        }

        const speed = 30; // pixels per second

        const walkSegment = (index: number) => {
            if (index >= segments.length) {
                this.startRest(animalState);
                return;
            }

            const segment = segments[index]!;
            animalState.direction = segment.direction;
            animalState.engine.play(this.getMoveAnimName(animalState.direction));

            const duration = Math.max(200, (segment.distance / speed) * 1000);
            const startX = animalState.x;
            const startY = animalState.y;
            const startTime = performance.now();

            const step = (timestamp: number) => {
                if (this.animationsPaused) return;
                const elapsed = timestamp - startTime;
                const progress = Math.min(1, elapsed / duration);
                const nextX = startX + segment.dx * progress;
                const nextY = startY + segment.dy * progress;
                animalState.x = Math.max(0, Math.min(maxX, nextX));
                animalState.y = Math.max(0, Math.min(maxY, nextY));
                animalState.el.setCssProps({
                    left: `${animalState.x}px`,
                    top: `${animalState.y}px`,
                });

                if (progress < 1) {
                    animalState.walkRaf = requestAnimationFrame(step);
                } else {
                    walkSegment(index + 1);
                }
            };

            animalState.walkRaf = requestAnimationFrame(step);
        };

        walkSegment(0);
    }

    onClose() {
        this.pauseAnimations();
        this.animals = [];
    }

    private pauseAnimations() {
        if (this.animationsPaused) return;
        this.animationsPaused = true;
        this.animals.forEach(animal => {
            if (animal.idleTimer) window.clearTimeout(animal.idleTimer);
            if (animal.actionTimer) window.clearTimeout(animal.actionTimer);
            if (animal.walkRaf) cancelAnimationFrame(animal.walkRaf);
            animal.engine.stop();
            animal.idleTimer = undefined;
            animal.actionTimer = undefined;
            animal.walkRaf = undefined;
        });
    }

    private resumeAnimations() {
        if (!this.animationsPaused) return;
        this.animationsPaused = false;
        this.animals.forEach(animal => this.startRest(animal));
    }

    private getMoveAnimName(direction: 'down' | 'left' | 'right' | 'up') {
        switch (direction) {
            case "down":
                return "moveDown";
            case "left":
                return "moveLeft";
            case "right":
                return "moveRight";
            case "up":
                return "moveUp";
            default:
                return "moveDown";
        }
    }

    private normalizeSpecieKey(specie: string): string | null {
        const key = specie.trim().toLowerCase();
        if (key in this.ANIMAL_CONFIG) return key;
        return null;
    }

    private getPluginResourcePath(file: string) {
        const pluginFile = `${this.app.vault.configDir}/plugins/${PLUGIN_ID}/${file}`;
        return this.app.vault.adapter.getResourcePath(pluginFile);
    }
}
