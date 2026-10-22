import { courseContentsQuery } from "@/features/courses/api";
import { call, callMany } from "@/lib/moodle/client";
import { safeName } from "@/lib/download";
import { e3Link, fileExt, fileUrl } from "@/lib/moodle/files";
import type { CourseModule, CourseSection } from "@/lib/moodle/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zip, ZipPassThrough, zipSync, type Zippable } from "fflate";
import { t } from "./messages";

// E3 calls folders 「教材」 and nearly every folder holds one to three files, so
// EM3 flattens them: the unit of material is the file, grouped by its folder.

export interface MaterialFile {
	key: string;
	name: string;
	url: string;
	size: number;
	mime: string;
	ext: string;
	time: number;
	path: string;
}

export type MaterialKind = "folder" | "resource" | "url" | "video" | "page" | "other";

export interface Material {
	key: string;
	cmid: number;
	instance: number;
	kind: MaterialKind;
	modname: string;
	title: string;
	section: CourseSection;
	files: MaterialFile[];
	/** Latest change to anything inside. */
	time: number;
	/** External link (url modules) or the E3 page for modules EM3 cannot render. */
	href?: string;
	module: CourseModule;
	description?: string;
}

const MATERIAL_MODS: Record<string, MaterialKind> = { folder: "folder", resource: "resource", url: "url", supervideo: "video", page: "page", book: "page", label: "other" };

export function materialsFrom(sections: CourseSection[]): Material[] {
	const out: Material[] = [];
	for (const section of sections) {
		if (!section.uservisible) continue;
		for (const m of section.modules) {
			const kind = MATERIAL_MODS[m.modname];
			if (!kind || !m.uservisible || m.modname === "label") continue;
			const files: MaterialFile[] = (m.contents ?? [])
				.filter(c => c.type === "file")
				.map(c => ({
					key: `${m.id}:${c.filepath}${c.filename}`,
					name: c.filename,
					url: c.fileurl,
					size: c.filesize,
					mime: c.mimetype ?? "",
					ext: fileExt(c.filename),
					time: c.timemodified,
					path: c.filepath
				}));
			const urlTarget = m.modname === "url" ? m.contents?.find(c => c.type === "url")?.fileurl : undefined;
			out.push({
				key: `m${m.id}`,
				cmid: m.id,
				instance: m.instance,
				kind,
				modname: m.modname,
				title: m.name,
				section,
				files,
				time: Math.max(0, ...files.map(f => f.time), m.contentsinfo?.lastmodified ?? 0),
				href: urlTarget ?? (kind === "video" || kind === "page" ? e3Link(`/mod/${m.modname}/view.php?id=${m.id}`) : undefined),
				module: m,
				description: m.description
			});
		}
	}
	return out;
}

interface FolderInfo {
	id: number;
	coursemodule: number;
	intro: string;
	introfiles?: { filename: string; fileurl: string; mimetype: string }[];
}

/** Folder intros hold notes, Google Drive links and embedded videos; core_course_get_contents omits them. */
export function useFolderIntros(courseId: number) {
	return useQuery({
		queryKey: ["folders", courseId],
		staleTime: 10 * 60_000,
		queryFn: async () => {
			const res = await call<{ folders: FolderInfo[] }>("mod_folder_get_folders_by_courses", { courseids: [courseId] });
			return new Map(res.folders.map(f => [f.coursemodule, f]));
		}
	});
}

/** Course contents for many courses in one round trip; seeds each course's own cache entry. */
export function useManyContents(courseIds: number[]) {
	const qc = useQueryClient();
	const ids = [...courseIds].sort((a, b) => a - b);
	return useQuery({
		queryKey: ["contents-many", ids],
		enabled: ids.length > 0,
		staleTime: 5 * 60_000,
		queryFn: async ({ signal }) => {
			const res = await callMany<CourseSection[]>(
				ids.map(courseid => ({ fn: "core_course_get_contents", args: { courseid } })),
				signal
			);
			const map = new Map<number, CourseSection[]>();
			res.forEach((sections, i) => {
				if (!sections) return;
				map.set(ids[i], sections);
				qc.setQueryData(courseContentsQuery(ids[i]).queryKey, sections);
			});
			return map;
		}
	});
}

export function fileKind(ext: string): "pdf" | "slides" | "doc" | "sheet" | "video" | "image" | "archive" | "code" | "audio" | "file" {
	if (ext === "pdf") return "pdf";
	if (["ppt", "pptx", "key", "odp"].includes(ext)) return "slides";
	if (["doc", "docx", "odt", "rtf", "txt", "md"].includes(ext)) return "doc";
	if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "sheet";
	if (["mp4", "mov", "webm", "mkv", "m4v"].includes(ext)) return "video";
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(ext)) return "image";
	if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
	if (["mp3", "m4a", "wav"].includes(ext)) return "audio";
	if (["c", "cpp", "h", "py", "java", "js", "ts", "ipynb", "v", "sv", "sh", "json"].includes(ext)) return "code";
	return "file";
}

/** Files a browser can show inline. */
export const canPreview = (ext: string) => ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mov", "m4v", "mp3", "m4a", "wav", "txt"].includes(ext);

export interface PickedFile {
	file: MaterialFile;
	/** Folder to place the file in, for folders that hold more than one file. */
	folder?: string;
}

export interface ZipProgress {
	files: number;
	bytes: number;
}

/** fflate writes plain ZIP (no ZIP64): an archive must stay under 4 GiB, headers included. */
export const ZIP_LIMIT = 2 ** 32 - 64 * 1024 ** 2;
/** Above this, holding every file in memory gets risky, so EM3 streams to disk when it can. */
export const LARGE_ZIP = 500 * 1024 ** 2;

interface SaveFilePicker {
	showSaveFilePicker(opts: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }): Promise<FileSystemFileHandle>;
}

/** Chrome and Edge on desktop can write a file to disk piece by piece; Safari, Firefox and phones cannot. */
export const canStreamToDisk = () => "showSaveFilePicker" in window;

/** Paths inside the archive, in selection order: multi-file folders stay folders, clashes get 「 (2)」. */
function zipPaths(items: PickedFile[]) {
	const used = new Set<string>();
	return items.map(it => {
		const sub = it.file.path.split("/").filter(Boolean).map(safeName);
		const path = [it.folder && safeName(it.folder), ...sub, safeName(it.file.name)].filter(Boolean).join("/");
		let p = path;
		for (let n = 2; used.has(p); n++) p = path.replace(/(\.[^./]+)?$/, ` (${n})$1`);
		used.add(p);
		return p;
	});
}

async function fetchFile(f: MaterialFile, signal: AbortSignal) {
	const res = await fetch(fileUrl(f.url, { download: true }), { signal });
	if (!res.ok || !res.body) throw new Error(String(res.status));
	return res.body.getReader();
}

/**
 * Zips the picked files in memory. Fine for lecture slides; for large picks use
 * streamMaterialsZip where available. A few downloads run at a time to go easy on E3.
 */
export async function buildMaterialsZip(items: PickedFile[], signal: AbortSignal, onProgress: (p: ZipProgress) => void) {
	const paths = zipPaths(items);
	const tree: Zippable = {};
	const failed: string[] = [];
	const progress: ZipProgress = { files: 0, bytes: 0 };
	let next = 0;
	const worker = async () => {
		for (let i = next++; i < items.length; i = next++) {
			const { file } = items[i];
			const chunks: Uint8Array[] = [];
			try {
				const reader = await fetchFile(file, signal);
				for (let r = await reader.read(); !r.done; r = await reader.read()) {
					chunks.push(r.value);
					progress.bytes += r.value.length;
					onProgress({ ...progress });
				}
				const data = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
				chunks.reduce((at, c) => (data.set(c, at), at + c.length), 0);
				tree[paths[i]] = [data, { level: 0, mtime: file.time * 1000 }];
			} catch (e) {
				if (signal.aborted) throw e;
				failed.push(file.name);
			}
			progress.files++;
			onProgress({ ...progress });
		}
	};
	await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
	return { blob: new Blob([zipSync(tree) as BlobPart], { type: "application/zip" }), failed };
}

/**
 * Streams the archive straight into a file the user picks, one download at a
 * time, so memory stays flat however large the selection. Must be called
 * directly from a click: the save dialog needs the user gesture.
 * Resolves to null when the user cancels the save dialog.
 */
export async function streamMaterialsZip(items: PickedFile[], name: string, signal: AbortSignal, onProgress: (p: ZipProgress) => void) {
	let handle: FileSystemFileHandle;
	try {
		handle = await (window as unknown as SaveFilePicker).showSaveFilePicker({ suggestedName: name, types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }] });
	} catch (e) {
		if (e instanceof DOMException && e.name === "AbortError") return null;
		throw e;
	}
	const out = await handle.createWritable();
	const paths = zipPaths(items);
	const failed: string[] = [];
	const progress: ZipProgress = { files: 0, bytes: 0 };
	onProgress({ ...progress });
	// fflate emits chunks synchronously; chain the writes so they land in order.
	let writing: Promise<void> = Promise.resolve();
	let zipError: Error | null = null;
	const zip = new Zip((err, chunk) => {
		if (err) zipError = err;
		else writing = writing.then(() => out.write(chunk as Uint8Array<ArrayBuffer>));
	});
	try {
		for (let i = 0; i < items.length; i++) {
			const { file } = items[i];
			let reader: ReadableStreamDefaultReader<Uint8Array>;
			try {
				reader = await fetchFile(file, signal);
			} catch (e) {
				if (signal.aborted) throw e;
				failed.push(file.name);
				progress.files++;
				onProgress({ ...progress });
				continue;
			}
			const entry = new ZipPassThrough(paths[i]);
			entry.mtime = file.time * 1000;
			zip.add(entry);
			try {
				for (let r = await reader.read(); !r.done; r = await reader.read()) {
					entry.push(r.value);
					progress.bytes += r.value.length;
					onProgress({ ...progress });
					// Wait for the disk to catch up so chunks never pile up in memory.
					await writing;
				}
			} catch (e) {
				if (signal.aborted) throw e;
				failed.push(t("incomplete", file.name));
			} finally {
				entry.push(new Uint8Array(0), true);
			}
			progress.files++;
			onProgress({ ...progress });
		}
		zip.end();
		await writing;
		if (zipError) throw zipError;
		await out.close();
	} catch (e) {
		zip.terminate();
		await out.abort().catch(() => {});
		throw e;
	}
	return { failed };
}
