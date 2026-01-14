import type { FileItem } from "./api";

export function prepareMoveToTrashPayload(items: FileItem[], filesMap: Map<string, FileItem>) {
  const folderIds = items.filter(i => i.type === 'folder').map(i => i.id);
  const fileIds = items.filter(i => i.type === 'file' && i.mimeType !== 'application/x-paper').map(i => i.id);
  const paperIds = items.filter(i => i.mimeType === 'application/x-paper').map(i => i.id);

  const invalidFileIds = fileIds.filter(id => {
    const it = filesMap.get(id);
    return !it || it.type !== 'file' || it.mimeType === 'application/x-paper';
  });
  const invalidPaperIds = paperIds.filter(id => {
    const it = filesMap.get(id);
    return !it || it.mimeType !== 'application/x-paper';
  });
  const invalidFolderIds = folderIds.filter(id => {
    const it = filesMap.get(id);
    return !it || it.type !== 'folder';
  });

  if (invalidFileIds.length > 0 || invalidPaperIds.length > 0 || invalidFolderIds.length > 0) {
    const details = {
      invalidFileIds,
      invalidPaperIds,
      invalidFolderIds
    };
    throw new Error(`Type mismatch in selected items: ${JSON.stringify(details)}`);
  }

  return { folderIds, fileIds, paperIds };
}
