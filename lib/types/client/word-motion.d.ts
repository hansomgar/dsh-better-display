import type { MarkdownFileMentions } from '@deepseek-ai/dsh-client-ui-primitives';
/** Native Think is literal text, not Markdown. Spans never alter its bytes. */
export declare function MotionPlainText({ text, enabled, revision }: {
    text: string;
    enabled: boolean;
    revision: number;
}): import("react").JSX.Element;
/** Native DSH Markdown semantics with a stable text-leaf animation hook. */
<<<<<<< HEAD
export declare function MotionMarkdown({ text, streaming, enabled, revision, fileMentions, cwd, openFile }: {
=======
export declare function MotionMarkdown({ text, streaming, enabled, revision, fileMentions, cwd }: {
>>>>>>> origin/main
    text: string;
    streaming: boolean;
    enabled: boolean;
    revision: number;
    fileMentions?: MarkdownFileMentions;
    /** Session workspace, so a relative image destination resolves to a real file. */
    cwd?: string;
<<<<<<< HEAD
    /** Opens a file chip's target; the route that reaches the right-hand preview panel. */
    openFile?: (path: string, options?: {
        line?: number;
    }) => void;
=======
>>>>>>> origin/main
}): import("react").JSX.Element;
//# sourceMappingURL=word-motion.d.ts.map