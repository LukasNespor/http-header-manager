// Shared logic for translating stored rules into declarativeNetRequest rules.
// Loaded both by the service worker (importScripts) and the popup (classic script).

const STORAGE_KEY = "rules";

// Resource types a header rule should apply to. Covers every request the
// browser makes, including the top level document and XHR/fetch calls.
const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

// Chrome's declarativeNetRequest only allows the "append" operation for a
// small allowlist of headers that support multiple values (Cookie, Accept,
// etc.) — arbitrary custom headers throw "invalid request header to be
// appended". "Add" and "replace" both mean "set this header" for our purposes,
// so both map to "set".
const OPERATION_MAP = {
  add: "set",
  replace: "set",
  remove: "remove"
};

function createRule() {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    operation: "add",
    header: "",
    value: ""
  };
}

function isApplicable(rule) {
  if (!rule.enabled) return false;
  if (!rule.header.trim()) return false;
  // add/replace need a value, remove does not.
  if (rule.operation !== "remove" && !rule.value.trim()) return false;
  return true;
}

// Maps the stored rules onto a single declarativeNetRequest rule.
// One DNR rule can carry every header modification, which keeps us far below
// the dynamic rule quota no matter how many rules the user creates.
function toDeclarativeRules(rules) {
  const requestHeaders = rules.filter(isApplicable).map((rule) => {
    const modification = {
      header: rule.header.trim(),
      operation: OPERATION_MAP[rule.operation]
    };
    if (modification.operation !== "remove") {
      modification.value = rule.value;
    }
    return modification;
  });

  if (requestHeaders.length === 0) return [];

  return [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders
      },
      condition: {
        urlFilter: "*",
        resourceTypes: RESOURCE_TYPES
      }
    }
  ];
}

async function loadRules() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [STORAGE_KEY]: rules });
}

// Replaces all dynamic rules with the ones derived from storage.
async function applyRules(rules) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: toDeclarativeRules(rules)
  });
}
