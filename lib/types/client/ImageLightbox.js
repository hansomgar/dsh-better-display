import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
<<<<<<< HEAD
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { settleDrag } from './image-group-order.js';
import css from './Reader.module.css';
/** Zoom limits. Below 1 shows the whole picture; above 1 inspects detail. */
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
/** Double-click and the zoom buttons step through these. */
const ZOOM_STEP = 1.25;
/** Wheel sensitivity: `exp(-delta * WHEEL_FACTOR)` is linear in the hand. */
const WHEEL_FACTOR = 0.0015;
/** Resetting is a key press away, and the hint says which. */
const RESET_KEYS = new Set(['0', ' ']);
function clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}
function percent(scale) {
    return `${Math.round(scale * 100)}%`;
}
/**
 * The one image viewer for a group of pictures.
 *
 * Rendered by `ImageViewerScope`, never by a thumbnail: paging has to swap the
 * picture inside a single `<dialog>`, and a dialog belongs to a component that is
 * not one of the pictures being paged. That is the bug this replaces — each picture
 * owned a dialog, so `›` opened a second one on top instead of replacing the first,
 * and there was no way back.
 *
 * The stage is a genuine scroll container rather than a transform sandbox: a
 * picture larger than the viewport then has somewhere to go, and the native
 * scrollbars double as a "where am I" indicator.
 * @param props - the shared viewer state; the picture comes from `viewer.current`.
 */
export function ImageLightbox({ viewer }) {
    const dialog = useRef(null);
    const stage = useRef(null);
    const [scale, setScale] = useState(1);
    /** Natural pixel size, known once the picture decodes. */
    const [natural, setNatural] = useState(null);
    const [dragging, setDragging] = useState(false);
    /** True for a moment after the caption is double-clicked, to confirm the copy. */
    const [copied, setCopied] = useState(false);
    /** Whether the picture currently overflows the stage; drives the minimap. */
    const [pannable, setPannable] = useState(false);
    /**
     * Free displacement in client pixels, applied on top of the scroll position.
     *
     * `scrollLeft`/`scrollTop` are clamped to the scrollable range, so they cannot
     * push a picture past its own edge. A second unclamped layer carries the part the
     * range cannot express, so a picture smaller than the stage can be moved too.
     */
    const [free, setFree] = useState({ x: 0, y: 0 });
    /**
     * Mirror of `free` for the pointer handlers.
     *
     * They are bound to `window` once per gesture, so the closures they capture are
     * the ones from the frame the drag started in; reading `free` there would use a
     * stale value and undo most of the movement on release.
     */
    const freeRef = useRef({ x: 0, y: 0 });
    /** Stage and picture boxes for the minimap, in one shared canvas. */
    const [viewBox, setViewBox] = useState({
        view: { left: 0, top: 0, width: 1, height: 1 },
        picture: { left: 0, top: 0, width: 1, height: 1 }
    });
    const pendingAnchor = useRef(null);
    const dragStart = useRef(null);
    /** Set when a pointer gesture actually moved the picture, so its click is ignored. */
    const draggedRef = useRef(false);
    const current = viewer.current;
    const src = current?.src ?? '';
    const alt = current?.alt ?? '';
    const caption = current?.caption ?? '';
    const paging = viewer.total > 1;
    /** Reset to 100%, centred. Space does this. */
    const reset = useCallback(() => {
        setScale(1);
        freeRef.current = { x: 0, y: 0 };
        setFree(freeRef.current);
        const node = stage.current;
        if (node !== null) {
            node.scrollLeft = 0;
            node.scrollTop = 0;
        }
    }, []);
    /** Zoom, keeping the point under the cursor where it is. */
    const zoomAt = useCallback((next, clientX, clientY) => {
        const node = stage.current;
        const target = clampScale(next);
        if (target === scale)
            return;
        if (node !== null) {
            const box = node.getBoundingClientRect();
            const viewX = clientX === undefined ? box.width / 2 : clientX - box.left;
            const viewY = clientY === undefined ? box.height / 2 : clientY - box.top;
            pendingAnchor.current = {
                contentX: (node.scrollLeft + viewX) / scale,
                contentY: (node.scrollTop + viewY) / scale,
                viewX,
                viewY
            };
        }
        setScale(target);
    }, [scale]);
    // A new picture starts from a clean state: 100%, centred, nothing dragged.
    useEffect(() => {
        setScale(1);
        setNatural(null);
        freeRef.current = { x: 0, y: 0 };
        setFree(freeRef.current);
        if (stage.current !== null) {
            stage.current.scrollLeft = 0;
            stage.current.scrollTop = 0;
        }
    }, [src]);
    // Open while a picture is selected, closed otherwise. Closing from outside (the
    // backdrop, Esc, the × button) clears the selection so state cannot disagree
    // with the DOM.
    useEffect(() => {
        const node = dialog.current;
        if (node === null)
            return;
        if (current !== null && !node.open)
            node.showModal();
        if (current === null && node.open)
            node.close();
    }, [current]);
    useEffect(() => {
        const node = dialog.current;
        if (node === null)
            return undefined;
        const onClose = () => {
            if (viewer.current !== null)
                viewer.close();
        };
        node.addEventListener('close', onClose);
        return () => {
            node.removeEventListener('close', onClose);
        };
    }, [viewer]);
    // Apply the zoom anchor after layout but before paint, so nothing jumps.
    useLayoutEffect(() => {
        const node = stage.current;
        const anchor = pendingAnchor.current;
        if (node === null || anchor === null)
            return;
        pendingAnchor.current = null;
        node.scrollLeft = anchor.contentX * scale - anchor.viewX;
        node.scrollTop = anchor.contentY * scale - anchor.viewY;
    }, [scale]);
    // Track the picture and viewport boxes for the minimap, in one canvas, so it can
    // show a picture half out of the window as actually half out.
    useLayoutEffect(() => {
        const node = stage.current;
        if (node === null)
            return;
        const measure = () => {
            const viewWidth = node.clientWidth;
            const viewHeight = node.clientHeight;
            const pictureWidth = natural === null ? viewWidth : natural.width * scale;
            const pictureHeight = natural === null ? viewHeight : natural.height * scale;
            const pictureLeft = -node.scrollLeft + free.x;
            const pictureTop = -node.scrollTop + free.y;
            const minX = Math.min(0, pictureLeft);
            const minY = Math.min(0, pictureTop);
            const maxX = Math.max(viewWidth, pictureLeft + pictureWidth);
            const maxY = Math.max(viewHeight, pictureTop + pictureHeight);
            const spanX = maxX - minX || 1;
            const spanY = maxY - minY || 1;
            setViewBox({
                view: {
                    left: (0 - minX) / spanX,
                    top: (0 - minY) / spanY,
                    width: viewWidth / spanX,
                    height: viewHeight / spanY
                },
                picture: {
                    left: (pictureLeft - minX) / spanX,
                    top: (pictureTop - minY) / spanY,
                    width: pictureWidth / spanX,
                    height: pictureHeight / spanY
                }
            });
            setPannable(node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        node.addEventListener('scroll', measure, { passive: true });
        return () => {
            observer.disconnect();
            node.removeEventListener('scroll', measure);
        };
    }, [scale, natural, src, free]);
    // The wheel must not scroll the page behind the dialog, and React's `onWheel` is
    // passive, so this binds directly.
    useEffect(() => {
        const node = stage.current;
        if (node === null)
            return undefined;
        const onWheel = (event) => {
            event.preventDefault();
            zoomAt(scale * Math.exp(-event.deltaY * WHEEL_FACTOR), event.clientX, event.clientY);
        };
        node.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            node.removeEventListener('wheel', onWheel);
        };
    }, [scale, zoomAt]);
    // Dragging pans two layers. Releasing keeps the picture where it was put and only
    // pulls it back enough that a sliver stays visible.
    useEffect(() => {
        if (!dragging)
            return undefined;
        const onMove = (event) => {
            const start = dragStart.current;
            const node = stage.current;
            if (start === null || node === null)
                return;
            if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 2) {
                draggedRef.current = true;
            }
            const settled = settleDrag({
                wantLeft: start.left - (event.clientX - start.x),
                wantTop: start.top - (event.clientY - start.y),
                maxLeft: node.scrollWidth - node.clientWidth,
                maxTop: node.scrollHeight - node.clientHeight,
                freeX: start.freeX,
                freeY: start.freeY,
                release: false
            });
            node.scrollLeft = settled.left;
            node.scrollTop = settled.top;
            freeRef.current = { x: settled.freeX, y: settled.freeY };
            setFree(freeRef.current);
        };
        const onUp = () => {
            const node = stage.current;
            dragStart.current = null;
            setDragging(false);
            if (node === null)
                return;
            const pictureWidth = natural === null ? node.clientWidth : natural.width * scale;
            const pictureHeight = natural === null ? node.clientHeight : natural.height * scale;
            const settled = settleDrag({
                wantLeft: node.scrollLeft,
                wantTop: node.scrollTop,
                maxLeft: node.scrollWidth - node.clientWidth,
                maxTop: node.scrollHeight - node.clientHeight,
                freeX: freeRef.current.x,
                freeY: freeRef.current.y,
                release: true,
                visibleFraction: 0.15,
                viewWidth: node.clientWidth,
                viewHeight: node.clientHeight,
                pictureWidth,
                pictureHeight,
                restX: (node.clientWidth - pictureWidth) / 2,
                restY: (node.clientHeight - pictureHeight) / 2
=======
/**
 * A full-screen picture viewer: zoom about the pointer, pan, and reset.
 *
 * The Host's own preview dialog shows the picture at fit-width and nothing more. A
 * screenshot of a dense UI needs reading at 100% or beyond, so this keeps the dialog
 * and adds the interactions that make that possible:
 *
 *  - 100% means "fit the viewport", and a picture smaller than the stage stays at its
 *    natural pixels; the wheel then zooms that base from 0.5× to 8× about the pointer;
 *  - dragging pans at any scale and keeps the picture where it was put;
 *  - space or `0` returns to 100%, centred. Shortcuts live on the dialog, so a button
 *    keeps its own Space activation and Cmd/Ctrl+0 is left alone.
 *
 * The dialog is the native `<dialog>` element, so the browser owns Escape, the top
 * layer and the focus trap.
 *
 * @module
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './Reader.module.css';
/** Smallest and largest scale the wheel can reach, relative to the fitted base. */
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
/** How much of the picture must stay on screen after a drag, as a fraction. */
const KEEP_VISIBLE = 0.15;
/** Clamp a scale to the supported range. */
export function clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}
/**
 * The size the picture has at 100%.
 *
 * A picture smaller than the stage keeps its natural pixels. A larger one scales down
 * so 100% shows the whole picture, and the wheel zooms that fitted size.
 * @param naturalWidth - the image's natural width.
 * @param naturalHeight - the image's natural height.
 * @param viewWidth - the stage viewport width.
 * @param viewHeight - the stage viewport height.
 * @returns the fitted width and height, or zeros when the picture itself is unusable.
 */
export function fitSize(naturalWidth, naturalHeight, viewWidth, viewHeight) {
    if (!Number.isFinite(naturalWidth) ||
        !Number.isFinite(naturalHeight) ||
        naturalWidth <= 0 ||
        naturalHeight <= 0) {
        return { width: 0, height: 0 };
    }
    if (!Number.isFinite(viewWidth) ||
        !Number.isFinite(viewHeight) ||
        viewWidth <= 0 ||
        viewHeight <= 0) {
        return { width: naturalWidth, height: naturalHeight };
    }
    const ratio = Math.min(1, viewWidth / naturalWidth, viewHeight / naturalHeight);
    return { width: naturalWidth * ratio, height: naturalHeight * ratio };
}
/**
 * Scroll limits and the centred rest offset for one painted size.
 * @param viewWidth - the stage viewport width.
 * @param viewHeight - the stage viewport height.
 * @param pictureWidth - the painted picture width.
 * @param pictureHeight - the painted picture height.
 * @returns the geometry a drag or a zoom consumes.
 */
export function buildGeometry(viewWidth, viewHeight, pictureWidth, pictureHeight) {
    return {
        viewWidth,
        viewHeight,
        pictureWidth,
        pictureHeight,
        maxLeft: Math.max(0, pictureWidth - viewWidth),
        maxTop: Math.max(0, pictureHeight - viewHeight),
        restX: Math.max(0, (viewWidth - pictureWidth) / 2),
        restY: Math.max(0, (viewHeight - pictureHeight) / 2)
    };
}
/**
 * Where a panned picture comes to rest.
 *
 * The scroll offset is clamped to the scrollable range, and whatever the drag asks for
 * beyond that is carried in a free offset, so the picture stays under the pointer.
 * On release the free offset is clamped only far enough that a sliver stays reachable.
 * The sliver is a fraction of the smaller of the picture and the viewport, and the
 * current scroll is part of the bound: without it a picture parked at the far edge
 * can be flung entirely off the stage, and a very large picture rejects even `0`.
 * @param input - the drag request and the current geometry.
 * @returns the scroll offsets and free offsets to apply.
 */
export function settleDrag(input) {
    const { geometry } = input;
    const effectiveLeft = input.wantLeft - input.freeX;
    const effectiveTop = input.wantTop - input.freeY;
    const left = Math.min(geometry.maxLeft, Math.max(0, effectiveLeft));
    const top = Math.min(geometry.maxTop, Math.max(0, effectiveTop));
    let freeX = left - effectiveLeft;
    let freeY = top - effectiveTop;
    if (input.release) {
        const sliverX = Math.min(geometry.pictureWidth, geometry.viewWidth) * KEEP_VISIBLE;
        const sliverY = Math.min(geometry.pictureHeight, geometry.viewHeight) * KEEP_VISIBLE;
        const minFreeX = sliverX - geometry.pictureWidth - geometry.restX + left;
        const maxFreeX = geometry.viewWidth - sliverX - geometry.restX + left;
        const minFreeY = sliverY - geometry.pictureHeight - geometry.restY + top;
        const maxFreeY = geometry.viewHeight - sliverY - geometry.restY + top;
        freeX = Math.min(maxFreeX, Math.max(minFreeX, freeX));
        freeY = Math.min(maxFreeY, Math.max(minFreeY, freeY));
    }
    return { left, top, freeX, freeY };
}
/**
 * The scroll position that keeps one picture point under the pointer across a zoom.
 * @param input - the scales, the pointer in stage coordinates, and the current pan.
 * @returns the scroll and free offsets to apply once the picture has the new size.
 */
export function zoomAroundPoint(input) {
    const oldW = input.baseWidth * input.currentScale;
    const oldH = input.baseHeight * input.currentScale;
    const newW = input.baseWidth * input.nextScale;
    const newH = input.baseHeight * input.nextScale;
    const oldGeom = buildGeometry(input.viewWidth, input.viewHeight, oldW, oldH);
    const newGeom = buildGeometry(input.viewWidth, input.viewHeight, newW, newH);
    if (oldW <= 0 || oldH <= 0) {
        return { left: newGeom.maxLeft / 2, top: newGeom.maxTop / 2, freeX: 0, freeY: 0 };
    }
    const oldImgLeft = oldGeom.restX - input.scrollLeft + input.freeX;
    const oldImgTop = oldGeom.restY - input.scrollTop + input.freeY;
    const u = (input.pointerX - oldImgLeft) / oldW;
    const v = (input.pointerY - oldImgTop) / oldH;
    const targetImgLeft = input.pointerX - u * newW;
    const targetImgTop = input.pointerY - v * newH;
    const effectiveLeft = newGeom.restX - targetImgLeft;
    const effectiveTop = newGeom.restY - targetImgTop;
    return settleDrag({
        wantLeft: effectiveLeft,
        wantTop: effectiveTop,
        freeX: 0,
        freeY: 0,
        release: true,
        geometry: newGeom
    });
}
/** Read a loaded image's natural size, ignoring a broken or not-yet-decoded picture. */
function naturalSize(image) {
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
        return null;
    return { width: image.naturalWidth, height: image.naturalHeight };
}
/**
 * The viewer dialog.
 * @param props - the picture, its caption, and the open state.
 */
export function ImageLightbox({ open, src, alt, caption, onClose }) {
    const dialog = useRef(null);
    const stage = useRef(null);
    const image = useRef(null);
    const [scale, setScale] = useState(1);
    const [natural, setNatural] = useState(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [free, setFree] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [copied, setCopied] = useState(false);
    const scaleRef = useRef(1);
    const freeRef = useRef({ x: 0, y: 0 });
    const baseSizeRef = useRef(null);
    const pendingScrollRef = useRef(null);
    const drag = useRef(null);
    /** Swallow the click that ends a drag, so it cannot reach the backdrop. */
    const dragged = useRef(false);
    const dragResetTimer = useRef(null);
    const copyTimer = useRef(null);
    const mounted = useRef(true);
    const seenSrc = useRef(null);
    const baseSize = useMemo(() => natural && stageSize.width > 0 && stageSize.height > 0
        ? fitSize(natural.width, natural.height, stageSize.width, stageSize.height)
        : null, [natural, stageSize.width, stageSize.height]);
    scaleRef.current = scale;
    freeRef.current = free;
    baseSizeRef.current = baseSize;
    // A new picture starts at 100%. The layout read below then accepts a cached image
    // whose `load` event will not fire again.
    useLayoutEffect(() => {
        if (seenSrc.current !== src) {
            seenSrc.current = src;
            scaleRef.current = 1;
            freeRef.current = { x: 0, y: 0 };
            pendingScrollRef.current = null;
            setScale(1);
            setFree({ x: 0, y: 0 });
            setCopied(false);
            setNatural(null);
        }
        const loaded = image.current === null ? null : naturalSize(image.current);
        if (loaded !== null)
            setNatural(loaded);
    }, [src, open]);
    // Open and close through the element, so Escape keeps working. Focus the stage,
    // not the close button: Space and `0` then reset, and Space on a button still clicks it.
    useLayoutEffect(() => {
        const node = dialog.current;
        if (node === null)
            return;
        if (open && !node.open) {
            node.showModal();
            stage.current?.focus();
        }
        if (!open && node.open)
            node.close();
    }, [open]);
    // The fitted base follows the stage. A resize must not throw away the reader's zoom.
    useLayoutEffect(() => {
        const node = stage.current;
        if (!open || node === null)
            return;
        const measure = () => {
            const width = node.clientWidth;
            const height = node.clientHeight;
            if (width <= 0 || height <= 0)
                return;
            setStageSize(current => current.width === width && current.height === height ? current : { width, height });
        };
        measure();
        if (typeof ResizeObserver !== 'function')
            return;
        const observer = new ResizeObserver(() => measure());
        observer.observe(node);
        return () => observer.disconnect();
    }, [open]);
    const readGeometry = useCallback(() => {
        const view = stage.current;
        const picture = image.current;
        if (view === null || picture === null)
            return null;
        // The inner wrapper is `min-width: 100%`, so measuring it reports the viewport
        // for a small picture and the rest offset collapses to zero. Use the fitted
        // size when we have it, and the image's own border box otherwise.
        const base = baseSizeRef.current;
        const pictureWidth = base === null ? picture.getBoundingClientRect().width : base.width * scaleRef.current;
        const pictureHeight = base === null ? picture.getBoundingClientRect().height : base.height * scaleRef.current;
        return buildGeometry(view.clientWidth, view.clientHeight, pictureWidth, pictureHeight);
    }, []);
    const centre = useCallback(() => {
        const node = stage.current;
        const geometry = readGeometry();
        if (node === null || geometry === null)
            return;
        node.scrollLeft = Math.max(0, (geometry.pictureWidth - node.clientWidth) / 2);
        node.scrollTop = Math.max(0, (geometry.pictureHeight - node.clientHeight) / 2);
    }, [readGeometry]);
    const reset = useCallback(() => {
        scaleRef.current = 1;
        setScale(1);
        freeRef.current = { x: 0, y: 0 };
        setFree({ x: 0, y: 0 });
        pendingScrollRef.current = null;
        // Scale may already be 1 (a pan at 100%). Setting it again does not re-run the
        // layout effect, so centre here or the picture stays where the drag left it.
        centre();
    }, [centre]);
    // Apply a zoom's pending scroll after the picture has its new size. Anything else
    // (first open, reset, stage resize) lands in the middle without carrying a stale free offset.
    // Never write scroll from a setScale updater: the image has not been laid out yet, and the
    // old scroll range clips the anchor.
    useLayoutEffect(() => {
        if (!open || stage.current === null)
            return;
        const node = stage.current;
        if (pendingScrollRef.current !== null) {
            const pending = pendingScrollRef.current;
            pendingScrollRef.current = null;
            node.scrollLeft = pending.left;
            node.scrollTop = pending.top;
            return;
        }
        if (freeRef.current.x !== 0 || freeRef.current.y !== 0) {
            freeRef.current = { x: 0, y: 0 };
            setFree(freeRef.current);
        }
        centre();
    }, [scale, baseSize, open, centre]);
    // The wheel zooms about the pointer; the page behind the dialog must not scroll.
    useEffect(() => {
        const node = stage.current;
        if (node === null || !open)
            return;
        const onWheel = (event) => {
            event.preventDefault();
            if (event.deltaY === 0)
                return;
            const currentScale = scaleRef.current;
            const base = baseSizeRef.current;
            const nextScale = clampScale(currentScale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
            if (nextScale === currentScale || base === null)
                return;
            const rect = node.getBoundingClientRect();
            const pointerX = event.clientX - rect.left;
            const pointerY = event.clientY - rect.top;
            const pending = pendingScrollRef.current;
            const settled = zoomAroundPoint({
                currentScale,
                nextScale,
                pointerX,
                pointerY,
                scrollLeft: pending?.left ?? node.scrollLeft,
                scrollTop: pending?.top ?? node.scrollTop,
                freeX: freeRef.current.x,
                freeY: freeRef.current.y,
                baseWidth: base.width,
                baseHeight: base.height,
                viewWidth: node.clientWidth,
                viewHeight: node.clientHeight
            });
            pendingScrollRef.current = { left: settled.left, top: settled.top };
            scaleRef.current = nextScale;
            setScale(nextScale);
            freeRef.current = { x: settled.freeX, y: settled.freeY };
            setFree(freeRef.current);
        };
        node.addEventListener('wheel', onWheel, { passive: false });
        return () => node.removeEventListener('wheel', onWheel);
    }, [open]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (copyTimer.current !== null)
                clearTimeout(copyTimer.current);
            if (dragResetTimer.current !== null)
                clearTimeout(dragResetTimer.current);
        };
    }, []);
    const onPointerDown = (event) => {
        if (event.button !== 0)
            return;
        const node = stage.current;
        if (node === null)
            return;
        if (dragResetTimer.current !== null) {
            clearTimeout(dragResetTimer.current);
            dragResetTimer.current = null;
        }
        dragged.current = false;
        setDragging(true);
        drag.current = {
            startX: event.clientX,
            startY: event.clientY,
            startLeft: node.scrollLeft,
            startTop: node.scrollTop,
            startFreeX: freeRef.current.x,
            startFreeY: freeRef.current.y,
            moved: false
        };
        try {
            node.setPointerCapture(event.pointerId);
        }
        catch {
            // A synthetic or already-released pointer cannot be captured. Moves still arrive
            // while the pointer stays over the stage.
        }
    };
    const onPointerMove = (event) => {
        const state = drag.current;
        const node = stage.current;
        if (state === null || node === null)
            return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (Math.abs(dx) + Math.abs(dy) > 2) {
            state.moved = true;
            dragged.current = true;
        }
        if (!state.moved)
            return;
        const geometry = readGeometry();
        if (geometry === null)
            return;
        // `dx` is the distance from the pointer-down origin. Subtract it from the scroll
        // recorded then. Subtracting it from the scroll this frame already updated feeds
        // the same distance back in on every move, and the picture runs away.
        const settled = settleDrag({
            wantLeft: state.startLeft - dx,
            wantTop: state.startTop - dy,
            freeX: state.startFreeX,
            freeY: state.startFreeY,
            release: false,
            geometry
        });
        node.scrollLeft = settled.left;
        node.scrollTop = settled.top;
        freeRef.current = { x: settled.freeX, y: settled.freeY };
        setFree(freeRef.current);
    };
    const onPointerUp = (event) => {
        const state = drag.current;
        const node = stage.current;
        drag.current = null;
        setDragging(false);
        if (node !== null &&
            typeof node.hasPointerCapture === 'function' &&
            node.hasPointerCapture(event.pointerId)) {
            node.releasePointerCapture(event.pointerId);
        }
        if (state === null || !state.moved || node === null)
            return;
        const geometry = readGeometry();
        if (geometry !== null) {
            const settled = settleDrag({
                wantLeft: node.scrollLeft,
                wantTop: node.scrollTop,
                freeX: freeRef.current.x,
                freeY: freeRef.current.y,
                release: true,
                geometry
>>>>>>> origin/main
            });
            node.scrollLeft = settled.left;
            node.scrollTop = settled.top;
            freeRef.current = { x: settled.freeX, y: settled.freeY };
            setFree(freeRef.current);
<<<<<<< HEAD
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [dragging, natural, scale]);
    const onKeyDown = (event) => {
        if (RESET_KEYS.has(event.key)) {
            event.preventDefault();
            reset();
            return;
        }
        if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoomAt(scale * ZOOM_STEP);
            return;
        }
        if (event.key === '-' || event.key === '_') {
            event.preventDefault();
            zoomAt(scale / ZOOM_STEP);
            return;
        }
        if (viewer.total > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            viewer.step(event.key === 'ArrowLeft' ? -1 : 1);
        }
    };
    const width = natural === null ? undefined : Math.round(natural.width * scale);
    const height = natural === null ? undefined : Math.round(natural.height * scale);
    return (_jsxs("dialog", { ref: dialog, className: css.imageDialog, "aria-label": "\u56FE\u7247\u9884\u89C8", onKeyDown: onKeyDown, onClick: event => {
            // A drag that ends over the backdrop still fires a click on the dialog; that
            // click must not close the viewer.
            if (draggedRef.current) {
                draggedRef.current = false;
                return;
            }
            if (event.target === dialog.current)
                viewer.close();
        }, children: [_jsx("button", { type: "button", autoFocus: true, className: css.dialogClose, "aria-label": "\u5173\u95ED\u56FE\u7247\u9884\u89C8", onClick: () => viewer.close(), children: "\u00D7" }), _jsxs("div", { className: css.lightboxHeader, children: [_jsx("span", { className: css.lightboxCaption, title: `${caption}\n双击复制路径`, "data-reader-image-caption": true, "data-copied": copied ? '' : undefined, onDoubleClick: () => {
                            void navigator.clipboard?.writeText(caption);
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1200);
                        }, children: copied ? '已复制' : caption }), _jsxs("div", { className: css.lightboxPager, "data-reader-image-pager": true, children: [_jsx("button", { type: "button", className: css.lightboxNav, "aria-label": "\u4E0A\u4E00\u5F20", disabled: !paging || viewer.index <= 1, onClick: () => viewer.step(-1), children: "\u2039" }), _jsxs("span", { className: css.lightboxCounter, "data-reader-image-counter": true, children: [viewer.index, "/", viewer.total] }), _jsx("button", { type: "button", className: css.lightboxNav, "aria-label": "\u4E0B\u4E00\u5F20", disabled: !paging || viewer.index >= viewer.total, onClick: () => viewer.step(1), children: "\u203A" })] })] }), _jsx("div", { ref: stage, className: css.imageStage, "data-pannable": pannable ? '' : undefined, "data-dragging": dragging ? '' : undefined, onPointerDown: event => {
                    const node = stage.current;
                    if (node === null)
                        return;
                    event.preventDefault();
                    draggedRef.current = false;
                    dragStart.current = {
                        x: event.clientX,
                        y: event.clientY,
                        left: node.scrollLeft,
                        top: node.scrollTop,
                        freeX: freeRef.current.x,
                        freeY: freeRef.current.y
                    };
                    setDragging(true);
                }, onDoubleClick: () => {
                    if (scale === 1) {
                        zoomAt(2.5);
                    }
                    else {
                        reset();
                    }
                }, children: _jsx("div", { className: css.imageStageInner, style: free.x === 0 && free.y === 0
                        ? undefined
                        : { transform: `translate(${free.x}px, ${free.y}px)` }, children: _jsx("img", { src: src, alt: alt, draggable: false, width: width, height: height, style: width === undefined ? undefined : { width: `${width}px`, height: `${height}px` }, onLoad: event => {
                            const node = event.currentTarget;
                            setNatural({ width: node.naturalWidth, height: node.naturalHeight });
                        } }) }) }), dragging && (_jsxs("div", { className: css.lightboxMinimap, "aria-hidden": "true", children: [_jsx("img", { src: src, alt: "", "data-reader-image-minimap": true, style: {
                            position: 'absolute',
                            left: `${viewBox.picture.left * 100}%`,
                            top: `${viewBox.picture.top * 100}%`,
                            width: `${viewBox.picture.width * 100}%`,
                            height: `${viewBox.picture.height * 100}%`,
                            objectFit: 'fill',
                            opacity: 0.55
                        } }), _jsx("div", { className: css.lightboxViewBox, "data-reader-image-viewbox": true, style: {
                            left: `${viewBox.view.left * 100}%`,
                            top: `${viewBox.view.top * 100}%`,
                            width: `${viewBox.view.width * 100}%`,
                            height: `${viewBox.view.height * 100}%`
                        } })] })), _jsxs("div", { className: css.lightboxToolbar, children: [_jsx("button", { type: "button", className: css.lightboxButton, "aria-label": "\u7F29\u5C0F", onClick: () => zoomAt(scale / ZOOM_STEP), children: "\u2212" }), _jsx("output", { className: css.lightboxScale, "aria-live": "polite", "data-reader-image-scale": true, children: percent(scale) }), _jsx("button", { type: "button", className: css.lightboxButton, "aria-label": "\u653E\u5927", onClick: () => zoomAt(scale * ZOOM_STEP), children: "+" }), _jsx("button", { type: "button", className: css.lightboxButton, onClick: reset, title: "\u91CD\u7F6E\u4E3A 100%\uFF08\u6309\u7A7A\u683C\uFF09", children: "100%" })] })] }));
=======
        }
        // A drag that ends outside the dialog never produces a click, so the guard would
        // otherwise swallow the next backdrop click. A click from this gesture is dispatched
        // before the timeout, and the click handler consumes the flag first.
        if (dragResetTimer.current !== null)
            clearTimeout(dragResetTimer.current);
        dragResetTimer.current = setTimeout(() => {
            dragResetTimer.current = null;
            dragged.current = false;
        }, 0);
    };
    const onDialogKeyDown = (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey)
            return;
        if (event.key === ' ' &&
            event.target instanceof HTMLElement &&
            event.target.closest('button, a, input, textarea, select')) {
            return;
        }
        if (event.key === ' ' || event.key === '0') {
            event.preventDefault();
            reset();
        }
    };
    return (_jsxs("dialog", { ref: dialog, className: css.imageDialog, "aria-label": "\u56FE\u7247\u9884\u89C8", onClose: onClose, onKeyDown: onDialogKeyDown, onClick: event => {
            // A click that ends a drag must not close the dialog. Consuming the flag here
            // also stops it covering a later, genuine backdrop click.
            if (dragged.current) {
                dragged.current = false;
                return;
            }
            if (event.target === dialog.current)
                onClose();
        }, children: [_jsxs("div", { className: css.lightboxHeader, children: [_jsx("button", { type: "button", className: css.lightboxCaption, title: `${caption}\n双击复制路径`, "data-reader-image-caption": true, "data-copied": copied || undefined, onDoubleClick: () => {
                            void writeClipboard(caption).then(ok => {
                                if (!mounted.current || ok !== true)
                                    return;
                                setCopied(true);
                                if (copyTimer.current !== null)
                                    clearTimeout(copyTimer.current);
                                copyTimer.current = setTimeout(() => {
                                    copyTimer.current = null;
                                    if (mounted.current)
                                        setCopied(false);
                                }, 1200);
                            });
                        }, children: copied ? '已复制' : caption }), _jsx("div", { className: css.lightboxToolbar, children: _jsxs("button", { type: "button", className: css.lightboxButton, onClick: reset, title: "\u91CD\u7F6E\u4E3A 100%\uFF08\u6309\u7A7A\u683C\uFF09", children: [Math.round(scale * 100), "%"] }) })] }), _jsx("button", { type: "button", className: css.dialogClose, "aria-label": "\u5173\u95ED\u56FE\u7247\u9884\u89C8", onClick: onClose, children: "\u00D7" }), _jsx("div", { ref: stage, className: css.imageStage, tabIndex: -1, "data-zoomed": scale !== 1 || undefined, "data-dragging": dragging || undefined, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp, children: _jsx("div", { className: css.imageStageInner, style: { transform: `translate(${free.x}px, ${free.y}px)` }, children: _jsx("img", { ref: image, src: src, alt: alt, draggable: false, style: baseSize === null
                            ? undefined
                            : { width: baseSize.width * scale, height: baseSize.height * scale }, onLoad: event => {
                            const loaded = naturalSize(event.currentTarget);
                            if (loaded !== null)
                                setNatural(loaded);
                        } }) }) })] }));
>>>>>>> origin/main
}
//# sourceMappingURL=ImageLightbox.js.map