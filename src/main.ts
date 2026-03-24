import { Plugin } from 'obsidian';
import { StardewView, VIEW_TYPE_STARDEW } from './stardew-view';

//Save
type Pet = {
    name: string;
    specie: string;
    color: string;
}

class Save {
    public pets: Array<Pet> = new Array<Pet>();
}

let save = new Save();

export default class StardewPetsPlugin extends Plugin {
    async onload() {
        // Load save data
        await this.loadGame();

        // Register the Stardew view
        this.registerView(VIEW_TYPE_STARDEW, (leaf) => {
            return new StardewView(leaf);
        });

        // Command to open Stardew view
        this.addCommand({
            id: 'open-stardew-view',
            name: 'Open Stardew animals',
            callback: () => {
                const leaf = this.app.workspace.getLeftLeaf(true);
                leaf.setViewState({ type: VIEW_TYPE_STARDEW, active: true });
                this.app.workspace.revealLeaf(leaf);
            }

        });

        // Load existing pets when view is ready
        this.app.workspace.onLayoutReady(() => {
            this.loadPets();
        });
    }

    async onunload() {
        // Save game
        await this.saveGame();
    }

    async loadGame() {
        const data = await this.loadData();
        if (data && data.pets) {
            save.pets = data.pets;
        }
    }

    async saveGame() {
        await this.saveData(save);
    }

    loadPets() {
        const view = this.getStardewView();
        if (view) {
            for (const pet of save.pets) {
                view.spawnPet(pet.name, pet.specie, pet.color);
            }
        }
    }

    private getStardewView(): StardewView | null {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_STARDEW)[0];
        if (!leaf) {
            return null;
        }
        const view = leaf.view;
        return view instanceof StardewView ? view : null;
    }
}
