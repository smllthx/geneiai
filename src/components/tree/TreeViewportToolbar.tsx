import { useSyncExternalStore, type ComponentProps } from "react";
import TreeFloatingToolbar from "./TreeFloatingToolbar";
import type { TreeViewport } from "./treeViewport";

type Props = Omit<ComponentProps<typeof TreeFloatingToolbar>, "scale"> & { viewport: TreeViewport };

/** Only the small toolbar subscribes to zoom; the genealogy graph stays still. */
export default function TreeViewportToolbar({ viewport, ...props }: Props) {
  const scale = useSyncExternalStore(viewport.subscribe, viewport.getScale, viewport.getScale);
  return <TreeFloatingToolbar {...props} scale={scale} />;
}
