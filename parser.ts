import { yellow, cyan, green, gray } from "https://deno.land/std@0.86.0/fmt/colors.ts";
import ProgressBar from "https://deno.land/x/progress@v1.2.3/mod.ts";

class GithubSource {
  async getAllFile(): Promise<string[]> {
    const sha = await fetch('https://api.github.com/repos/tachiyomiorg/tachiyomi-extensions/contents/')
      .then(r => r.json() as Promise<{name: string, sha: string}[]>)
      .then(r => r.find(v => v.name === 'src')?.sha);
    
    const files = await fetch(`https://api.github.com/repos/tachiyomiorg/tachiyomi-extensions/git/trees/${sha}?recursive=true`)
      .then(r => r.json() as Promise<{tree: {path: string}[]}>)
      .then(r => r.tree.filter(v => /\w+\/\w+\/src\/eu\/kanade\/tachiyomi\/extension\/\w+\/\w+\/\w+.kt/.test(v.path)));
    
    return files.map(v => v.path);
  }

  async getFileGrouped(): Promise<Map<string, string[]>> {
    return this.getAllFile()
      .then(f => f.reduce((map, path) => {
        const ext = path.split('/', 2).join('.');
        return map.set(ext, [...map.get(ext) || [], path]);
      }, new Map<string, string[]>()))
  }

  async getFiles(group: string[]): Promise<string> {
    return fetch('https://cdn.jsdelivr.net/combine/' + group.map(v => `gh/tachiyomiorg/tachiyomi-extensions@master/src/${v}`).join(','))
      .then(r => r.text());
  }
}

class Parser {
  static regex = /^\s*override\s+val\s+name(?:\s*:\s*String)?\s*=\s*"([^"]+)"\s*$/gm;

  source = new GithubSource();
  extentions = new Map<string, string>();
  found = new Set<string>();
  bars: ProgressBar = new ProgressBar();

  async process() {
    const exts = await this.source.getFileGrouped();

    this.bars = new ProgressBar({
      total: exts.size,
      complete: '=',
      incomplete: ' ',
      clear: true,
      display: ':percent [:bar] :time :completed/:total :title',
    });
    let count = 0;

    for (const [ lang, files ] of exts) {
      this.bars.render(++count, {
        title: lang,
      });
      await this.processLang(lang, files);
    }
  }

  async processLang(lang: string, files: string[]) {
    try {
      await this.processFiles(lang, files);

      if (!this.found.has(lang)) {
        this.info(lang, 'No name found');
      }
    } catch (e) {
      this.warn(lang, 'Failed to read source');
    }
  }

  async processFiles(lang: string, files: string[]) {
    const data = await this.source.getFiles(files);

    for (let entry; (entry = Parser.regex.exec(data));) {
      this.extentions.set(entry[1].replace(/\$.*$/, ''), lang);
      this.found.add(lang);
    }
  }

  warn(lang: string, message: string) {
    this.bars.console([ yellow('[WARN]'), green(`[${lang}]`), gray(message) ].join(' '));
  }

  info(lang: string, message: string) {
    this.bars.console([ cyan('[INFO]'), green(`[${lang}]`), gray(message) ].join(' '));
  }

  toJSON() {
    return Object.fromEntries(this.extentions.entries());
  }
}

const p = new Parser();
await p.process();
if (Deno.args.length > 0) {
  await Deno.writeTextFile(Deno.args[0], JSON.stringify(p));
} else {
  console.log(JSON.stringify(p));
}
