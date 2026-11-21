/* Apply only the custom properties below, each with a validated value. This lets the CSP omit
 * 'unsafe-inline' while keeping injected markup from applying arbitrary styles.
 * The observer runs before the next paint. Layout reads in the same task as an innerHTML write
 * still see the DOM before those properties are applied. */
const isDataStylePercent = value => /^(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number(value) <= 100;

const DATA_STYLES = Object.freeze([
    Object.freeze(['data-th', '--th', value => /^https:\/\/levelthumbs\.prevter\.me\/thumbnail\/\d{1,12}(?:\/small)?$/.test(value), value => `url("${value}")`]),
    Object.freeze(['data-pct', '--pct', isDataStylePercent]),
    Object.freeze(['data-from', '--from', isDataStylePercent]),
    Object.freeze(['data-tag-color', '--tag-color', value => isHexColor(value) || value === 'var(--fg)']),
    Object.freeze(['data-swatch', '--swatch', isHexColor])
]);
const DATA_STYLE_SELECTOR = DATA_STYLES.map(([attribute]) => `[${attribute}]`).join(', ');

function applyDataStyles(root) {
    const apply = element => {
        for (const [attribute, property, valid, format] of DATA_STYLES) {
            const value = element.getAttribute(attribute);
            if (value != null && valid(value))
                element.style.setProperty(property, format ? format(value) : value);
        }
    };
    if (root.nodeType == 1)
        apply(root);
    root.querySelectorAll(DATA_STYLE_SELECTOR).forEach(apply);
}

applyDataStyles(document.documentElement);
new MutationObserver(records => {
    for (const record of records) {
        for (const node of record.addedNodes) {
            if (node.nodeType == 1)
                applyDataStyles(node);
        }
    }
}).observe(document.documentElement, { childList: true, subtree: true });
