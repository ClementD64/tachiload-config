import { join } from "https://deno.land/std@0.86.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.86.0/flags/mod.ts";
import { gzipDecode } from "https://github.com/manyuanrong/wasm_gzip/raw/master/mod.ts";
// @deno-types="./backup.d.ts"
import { Backup } from './backup.js';

interface Config {
  extension: string;
  language: string;
  data: {
    url: string,
    title: string|null|undefined,
    status: number|null|undefined,
    thumbnail_url: string|null|undefined,
    initialized: boolean,
  }
}

async function loader(root: string): Promise<Backup> {
  const dir: string[] = [];

  for await (const e of Deno.readDir(root)) {
    if (e.name.endsWith('.proto.gz')) {
      dir.push(e.name);
    }
  }

  const filename = join(root, dir.sort().slice(-1)[0]);
  const file = await Deno.readFile(filename);

  return Backup.decode(gzipDecode(file));
}

function process(backup: Backup, extensions: {[key: string]: string}): Config[] {
  return  backup.backupManga.map(manga => {
    const ext = backup.backupSources.find(v => v.sourceId === manga.source)?.name ?? '';
    if (!(ext in extensions)) {
      return;
    }
    const [ language, extension ] = extensions[ext].split('.', 2);
    return {
      extension,
      language,
      data: {
        url: manga.url,
        title: manga.title,
        status: manga.status,
        thumbnail_url: manga.thumbnailUrl,
        initialized: false,
      }
    } as Config;
  }).filter(v => v) as Config[];
}

async function main() {
  const args = parse(Deno.args, {
    string: [ 'backup', 'extensions' ],
    default: {
      extensions: 'extentions.json'
    }
  });
  
  const backup = await loader(args.backup);
  const extensions: {[key: string]: string} = JSON.parse(await Deno.readTextFile(args.extentions));
  const config = process(backup, extensions);

  if (args._.length === 0 || args._[0] === '-') {
    console.log(JSON.stringify(config));
  } else {
    await Deno.writeTextFile(args._[0].toString(), JSON.stringify(config));
  }
}

if (import.meta.main) {
  await main();
}
