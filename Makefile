BACKUP_DIR ?= ./backup
OUTPUT_FILE ?= config.json

.PHONY: build
build: ${OUTPUT_FILE}

.PHONY: watch
watch: build
	inotifywait -m -r -e modify,create,delete ${BACKUP_DIR} | while read _; do make; done

.PHONY: install
install: backup.js backup.d.ts extentions.json
	deno cache build.ts

tachiyomi.proto:
	deno run --allow-net https://raw.githubusercontent.com/ClementD64/tachiyomi-backup-models/main/mod.ts > $@

backup.js: tachiyomi.proto
	npx -p protobufjs pbjs -t static-module -w es6 --dependency "https://cdn.skypack.dev/protobufjs/minimal?dts" -o $@ $<
	sed -i 's/\* as //; /\* @/s/Long/\$$protobuf.Long/g;2i/// <reference path="./backup.d.ts" />' $@

backup.d.ts: backup.js
	npx -p protobufjs pbts -o $@ $<
	sed -i 's/from "protobufjs"/from "https:\/\/cdn.skypack.dev\/protobufjs\/minimal?dts"/' $@

extentions.json:
	deno run --allow-net --allow-write parser.ts $@

${OUTPUT_FILE}: extentions.json backup.js backup.d.ts ${BACKUP_DIR}/*
	deno run --allow-read --allow-write build.ts --backup ${BACKUP_DIR} --extentions $< $@
