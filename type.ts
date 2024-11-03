// types.ts
interface EnhancedNoteSettings {
    useCustomRules: boolean;
    defaultFrontmatter: boolean;
    ruleSets: RuleSet[];
    templaterEnabled: boolean;
}

interface RuleSet {
    name: string;
    condition: string;
    targetFolder: string;
    tags: string[];
    priority: number;
}

interface NoteFrontmatter {
    folder: string;
    tags: string[];
    automove: 0 | 1;
    created: string;
    modified: string;
}

// main.ts
import { Plugin, TFile, FrontMatterCache, Notice } from 'obsidian';

export default class EnhancedAutoMover extends Plugin {
    settings: EnhancedNoteSettings;

    async onload() {
        await this.loadSettings();

        // Process new note
        this.registerEvent(
            this.app.vault.on('create', async (file: TFile) => {
                if (!(file instanceof TFile)) return;
                await this.processNote(file);
            })
        );

        // Add settings tab
        this.addSettingTab(new EnhancedAutoMoverSettings(this.app, this));
    }

    async processNote(file: TFile) {
        const frontmatter = this.getFrontmatter(file);
        
        if (!frontmatter) {
            await this.createDefaultFrontmatter(file);
        }

        if (this.shouldProcessNote(frontmatter)) {
            const newLocation = await this.determineLocation(file);
            if (newLocation) {
                await this.moveNote(file, newLocation);
            }
        }
    }

    private async createDefaultFrontmatter(file: TFile) {
        const defaultFm: NoteFrontmatter = {
            folder: file.parent.path,
            tags: [],
            automove: 1,
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };

        await this.updateFrontmatter(file, defaultFm);
    }

    private async determineLocation(file: TFile): Promise<string | null> {
        if (this.settings.useCustomRules) {
            return this.processCustomRules(file);
        }
        return this.processDefaultRules(file);
    }
}

// settings.ts
import { App, PluginSettingTab, Setting } from 'obsidian';

export class EnhancedAutoMoverSettings extends PluginSettingTab {
    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Use Custom Rules')
            .setDesc('Enable custom rule processing')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCustomRules)
                .onChange(async (value) => {
                    this.plugin.settings.useCustomRules = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Frontmatter')
            .setDesc('Add default frontmatter to new notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultFrontmatter)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFrontmatter = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// processor.ts
export class FrontmatterProcessor {
    static async updateFrontmatter(app: App, file: TFile, data: NoteFrontmatter) {
        const content = await app.vault.read(file);
        const yaml = this.generateYaml(data);
        const newContent = content.replace(/^---\n.*?\n---\n/s, '') || content;
        await app.vault.modify(file, `---\n${yaml}---\n${newContent}`);
    }

    static generateYaml(data: NoteFrontmatter): string {
        return [
            `folder: "${data.folder}"`,
            `tags: [${data.tags.join(', ')}]`,
            `automove: ${data.automove}`,
            `created: "${data.created}"`,
            `modified: "${data.modified}"`
        ].join('\n');
    }
}