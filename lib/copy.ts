export type CopyEnvironment = {
  clipboard?: { writeText: (text: string) => Promise<void> };
  document?: {
    body: { appendChild: (element: CopyTextarea) => void };
    createElement: (tagName: "textarea") => CopyTextarea;
    execCommand: (command: "copy") => boolean;
  };
};

type CopyTextarea = {
  value: string;
  style: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
  focus: () => void;
  select: () => void;
  setSelectionRange: (start: number, end: number) => void;
  remove: () => void;
};

function runtimeEnvironment(): CopyEnvironment {
  return {
    clipboard: typeof navigator !== "undefined" ? navigator.clipboard : undefined,
    document: typeof document !== "undefined" ? document : undefined,
  } as CopyEnvironment;
}

export async function copyText(text: string, providedEnvironment?: CopyEnvironment): Promise<void> {
  const environment = providedEnvironment ?? runtimeEnvironment();
  if (environment.clipboard?.writeText) {
    try {
      await environment.clipboard.writeText(text);
      return;
    } catch {
      // LAN pages served over HTTP may reject Clipboard API access; try the user-gesture fallback below.
    }
  }

  const documentObject = environment.document;
  if (!documentObject) throw new Error("当前浏览器不允许复制，请长按文本选择复制。");

  const textarea = documentObject.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  documentObject.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    if (!documentObject.execCommand("copy")) throw new Error("execCommand copy failed");
  } catch {
    throw new Error("当前浏览器不允许复制，请长按文本选择复制。");
  } finally {
    textarea.remove();
  }
}
