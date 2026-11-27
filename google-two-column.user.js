// ==UserScript==
// @name         Google Two Column
// @namespace    https://github.com/uhovohu/google-two-column
// @version      2.6
// @description  Two-column layout for Google web search results: hides AI Overview, puts the knowledge panel first in the left column, and loads more results as you scroll
// @homepageURL  https://github.com/uhovohu/google-two-column
// @updateURL    https://raw.githubusercontent.com/uhovohu/google-two-column/main/google-two-column.user.js
// @downloadURL  https://raw.githubusercontent.com/uhovohu/google-two-column/main/google-two-column.user.js
// @include      /^https:\/\/(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?\/search(\?|$)/
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  // Skip non-web tabs (Images, Videos, Shopping, AI Mode, ...); keep the default tab and udm=14 (Web)
  const params = new URLSearchParams(location.search);
  const udm = params.get('udm');
  if (params.get('tbm') || (udm && udm !== '14')) return;

  const AI_STRUCT = '[data-attrid="AIOverview"], .j2luwe.pWvJNd, #m-x-content';
  // Exclude "People also ask" ([data-initq]) so its expanded AI answers don't hide the whole module
  const AI_SEL = `:is(${AI_STRUCT}):not([data-initq], [data-initq] *)`;
  const AI_HEADING_RE = /^(ai\s*overview|ai\s*概览|ai\s*摘要|人工智能概览)$/i;
  const PROTECTED = new Set(['rcnt', 'center_col', 'search', 'rso', 'rhs', 'botstuff', 'taw', 'topstuff', 'cnt', 'main']);
  const EMPTY_ATTR = 'data-g2col-empty';
  const WRAP_SEL = 'div:not([class]):has(> .MjjYud, > .ULSxyf)';
  const MEDIA_SEL = 'img, svg, video, canvas, iframe';
  const IGNORED_TAGS = new Set(['script', 'style', 'noscript', 'template']);
  // Match items directly under #rso and items inside the classless wrapper, but not the wrapper itself
  const rsoItem = (sel) => `#rso > ${sel}:not(${WRAP_SEL}), #rso > ${WRAP_SEL} > ${sel}`;

  const css = `
    /* AI Overview: hidden by structure selectors, plus anything the JS marks */
    ${AI_SEL},
    .SLPe5b.M8OgIe:has(${AI_SEL}),
    .FkX2oe:has(${AI_SEL}),
    ${rsoItem(`:has(${AI_SEL})`)},
    [data-g2col-ai-hidden] { display: none !important; }

    /* Google collapses .z4oRIf blocks inside the results area; undo it for the moved knowledge panel */
    #rso > #rhs .z4oRIf { height: auto !important; overflow: visible !important; }

    /* Two columns on wide screens; below 1024px Google's own single column is kept */
    @media (min-width: 1024px) {
      #cnt, #main { max-width: none !important; }

      #rcnt {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        grid-template-areas: none !important;
        width: min(1440px, calc(100vw - 48px)) !important;
        max-width: none !important;
        min-width: 0 !important;
        margin-inline: auto !important;
        padding-inline: 0 !important;
        gap: 16px !important;
      }

      /* A display:contents wrapper sits between #rcnt and #center_col, so target the element itself */
      #center_col {
        grid-column: 1 / -1 !important;
        grid-row: auto !important;
      }

      /* The knowledge panel (with its title blocks) is moved into #rso by the JS: first in the left column, spanning rows by height */
      #rso > #rhs { grid-column: 1 !important; position: static !important; }
      /* Its inner block carries the right-sidebar divider and a -21px left margin */
      #rhs > div { margin-inline: 0 !important; padding-left: 0 !important; border-left: none !important; }
      #rhs, #rhs > div, #rhs .kp-wholepage,
      #center_col, #search, #botstuff {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
      #center_col { margin-inline: 0 !important; padding-inline: 0 !important; }
      #rhs:empty, ${rsoItem(':empty')}, ${rsoItem(`[${EMPTY_ATTR}]`)} { display: none !important; }

      /* Results in two columns, cards in a row share the same height; tall modules span rows (set by the JS)
         and later results fill the other column in order. The grid is on #rso's parent and #rso is display:contents.
         No dense packing, so results appended by auto-paging only go at the end and never shift existing cards */
      #rso { display: contents !important; }
      div:has(> #rso) {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 16px !important;
        align-items: stretch !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      /* Some pages wrap results in an extra classless div; make it transparent so its children join the grid */
      #rso > ${WRAP_SEL} { display: contents !important; }
      ${rsoItem('*')}, #rso .N54PNb, #rso .Ww4FFb, #rso .tF2Cxc, #rso .g {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
      /* Every result and module takes one column as its own card */
      ${rsoItem('*')} {
        margin: 0 !important;
        padding: 16px 20px !important;
        border: 1px solid rgba(128, 128, 128, 0.2) !important;
        /* Same background as the search box (read by the JS); falls back to a faint tint of the text color */
        background: var(--g2col-card, color-mix(in srgb, currentColor 6%, transparent)) !important;
        border-radius: 12px !important;
        overflow: hidden !important;
      }
    }

    /* Auto-paging: status line below the grid; Google's pagination bar is hidden once it is active */
    #g2col-status { min-height: 1px; padding: 16px 0; text-align: center; font-size: 14px; opacity: 0.6; }
    body:has(#g2col-status) #botstuff [role="navigation"] { display: none !important; }
  `;

  const style = document.createElement('style');
  style.id = 'g2col-style';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  const isRsoWrap = (el) => el.parentElement?.id === 'rso' && el.matches(WRAP_SEL);

  function findAiModule(el, root) {
    const known = el.closest('.SLPe5b.M8OgIe, .FkX2oe');
    let target = known && root.contains(known) && !known.closest('#rso') ? known : null;
    if (!target) {
      target = el;
      while (
        target.parentElement &&
        target.parentElement !== root &&
        !PROTECTED.has(target.parentElement.id) &&
        !isRsoWrap(target.parentElement)
      ) {
        target = target.parentElement;
      }
    }
    if (
      !target ||
      target === root ||
      PROTECTED.has(target.id) ||
      isRsoWrap(target) ||
      target.querySelector('#center_col, #rso, #rhs')
    ) {
      return null;
    }
    return target;
  }

  // Walk the tree skipping script/style, since innerText falls back to textContent once an element is display:none
  function isEmptyShell(el) {
    if (IGNORED_TAGS.has(el.localName)) return true;
    if (el.matches(MEDIA_SEL) || el.querySelector(MEDIA_SEL)) return false;
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return IGNORED_TAGS.has(node.localName)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_SKIP;
        }
        return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    );
    return !walker.nextNode();
  }

  function markEmpty(el) {
    const empty = isEmptyShell(el);
    if (empty !== el.hasAttribute(EMPTY_ATTR)) {
      el.toggleAttribute(EMPTY_ATTR, empty);
    }
  }

  // Height of one row: recomputed as results stream in until the page finishes loading, then fixed so appended
  // results don't change cards already laid out; recomputed again when the window is resized
  let baseHeight = 0;

  // Card content height from its children's actual extent, without touching the layout (avoids scroll jumps)
  function contentHeight(el) {
    const top = el.getBoundingClientRect().top;
    let bottom = top;
    for (const child of el.children) {
      const rect = child.getBoundingClientRect();
      if (rect.height) bottom = Math.max(bottom, rect.bottom);
    }
    const cs = getComputedStyle(el);
    return bottom - top + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
  }

  // Rows to span by content height: tall modules (videos, People also ask, images, ...) span several rows,
  // and the following results fill in beside them
  function setSpans(rso) {
    const grid = rso.parentElement;
    if (getComputedStyle(grid).display !== 'grid') return;
    const items = [...rso.querySelectorAll(`:scope > :not(${WRAP_SEL}), :scope > ${WRAP_SEL} > *`)]
      .filter((el) => getComputedStyle(el).display !== 'none');
    if (items.length < 2) return;
    const heights = items.map(contentHeight);
    if (!baseHeight || document.readyState !== 'complete') {
      baseHeight = [...heights].sort((a, b) => a - b)[heights.length >> 1];
    }
    const gap = parseFloat(getComputedStyle(grid).rowGap);
    items.forEach((el, i) => {
      const n = Math.round((heights[i] + gap) / (baseHeight + gap));
      const value = n > 1 ? `span ${n}` : '';
      if (el.style.gridRow !== value) el.style.gridRow = value;
    });
  }

  function tidy() {
    const rcnt = document.getElementById('rcnt');
    if (rcnt) {
      // Layer 1: structure selectors (People also ask excluded)
      for (const el of rcnt.querySelectorAll(AI_SEL)) {
        const mod = findAiModule(el, rcnt);
        if (mod && !mod.hasAttribute('data-g2col-ai-hidden')) mod.setAttribute('data-g2col-ai-hidden', '1');
      }

      // Layer 2: heading text, in case Google renames its classes
      for (const el of rcnt.querySelectorAll('h1, h2, [role="heading"], strong, span')) {
        if (el.closest('[data-g2col-ai-hidden], a, #rhs, [data-initq]')) continue;
        if (!AI_HEADING_RE.test((el.textContent || '').replace(/\s+/g, ' ').trim())) continue;

        const mod = findAiModule(el, rcnt);
        // Skip nodes in #rso that contain a regular result title, so searching "AI Overview" doesn't hide results
        if (!mod || (mod.closest('#rso') && mod.querySelector('.yuRUbf'))) continue;
        mod.setAttribute('data-g2col-ai-hidden', '1');
      }
    }

    // The search box background follows the light/dark theme; copy it for the cards
    const box = document.querySelector('.RNNXgb');
    if (box) {
      const bg = getComputedStyle(box).backgroundColor;
      const root = document.documentElement.style;
      if (root.getPropertyValue('--g2col-card') !== bg) root.setProperty('--g2col-card', bg);
    }

    const rso = document.getElementById('rso');
    if (rso) {
      const rhs = document.getElementById('rhs');
      if (rhs) {
        if (rhs.parentElement !== rso) rso.prepend(rhs);
        // The .SLPe5b blocks at the top (title, photos, map) belong to the knowledge panel; move them to its start
        const heads = [...document.querySelectorAll('#rcnt .SLPe5b:not([data-g2col-ai-hidden])')]
          .filter((el) => !el.closest('#rso, #center_col'));
        rhs.prepend(...heads);
      }
      for (const child of rso.children) {
        if (child.matches(WRAP_SEL)) {
          child.removeAttribute(EMPTY_ATTR);
          for (const item of child.children) markEmpty(item);
        } else {
          markEmpty(child);
        }
      }
      setSpans(rso);
    }
    // The "Next" link may not be parsed yet when the script starts; start auto-paging once it appears
    if (!document.getElementById('g2col-status')) initAutoPage();
  }

  // Auto-paging: when the status line comes within one screen of the viewport, fetch the next page
  // and append only its regular results to the end of the grid
  function initAutoPage() {
    const rso = document.getElementById('rso');
    const link = document.getElementById('pnnext');
    if (!rso || !link) return;
    let next = link.href;
    let loading = false;
    const status = document.createElement('div');
    status.id = 'g2col-status';
    rso.parentElement.after(status);

    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading || !next) return;
      loading = true;
      status.textContent = 'Loading…';
      try {
        const html = await (await fetch(next, { credentials: 'include' })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // Thumbnails and favicons are filled in by page scripts, which don't run in the fetched page; restore them from the script data
        for (const [, src, ids] of html.matchAll(/var s='(data:image[^']*)';var ii=\[([^\]]*)\]/g)) {
          const url = src.replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          for (const [, id] of ids.matchAll(/'([^']+)'/g)) doc.getElementById(id)?.setAttribute('src', url);
        }
        // Regular results only: videos, images, People also ask, etc. need page scripts and arrive incomplete
        const items = [...doc.querySelectorAll(`#rso > .MjjYud, #rso > ${WRAP_SEL} > .MjjYud`)]
          .filter((el) => el.querySelector('a h3'));
        rso.append(...items.map((el) => document.adoptNode(el)));
        const nextLink = doc.getElementById('pnnext');
        next = nextLink ? new URL(nextLink.getAttribute('href'), location.href).href : '';
        status.textContent = next ? '' : 'No more results';
        // If the appended results don't fill the screen, observe again to keep loading
        observer.unobserve(status);
        observer.observe(status);
      } catch {
        // No immediate retry; retry when the status line scrolls into range again
        status.textContent = 'Failed to load, scroll down to retry';
      }
      loading = false;
    }, { rootMargin: '0px 0px 100% 0px' });
    observer.observe(status);
  }

  const start = () => {
    tidy();
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        tidy();
      });
    };
    // Watch only structure and text changes; marks and spans only change attributes, so this never loops
    new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
    addEventListener('resize', () => {
      baseHeight = 0;
      schedule();
    });
  };

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
