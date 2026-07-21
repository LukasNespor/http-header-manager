// Common request headers offered as autocomplete suggestions. The field stays a
// free text input, so nonstandard headers can be typed as well.
const COMMON_HEADERS = [
  "Accept",
  "Accept-Charset",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Connection",
  "Content-Length",
  "Content-Type",
  "Cookie",
  "DNT",
  "Expect",
  "Forwarded",
  "From",
  "Host",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "If-Range",
  "If-Unmodified-Since",
  "Origin",
  "Pragma",
  "Prefer",
  "Range",
  "Referer",
  "Sec-Fetch-Dest",
  "Sec-Fetch-Mode",
  "Sec-Fetch-Site",
  "Sec-Fetch-User",
  "Sec-GPC",
  "TE",
  "Upgrade-Insecure-Requests",
  "User-Agent",
  "Via",
  "X-Api-Key",
  "X-Correlation-ID",
  "X-CSRF-Token",
  "X-Forwarded-For",
  "X-Forwarded-Host",
  "X-Forwarded-Proto",
  "X-Requested-With"
];

const list = document.getElementById("list");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const template = document.getElementById("row-template");

let rules = [];

function fillHeaderSuggestions() {
  const datalist = document.getElementById("header-names");
  for (const name of COMMON_HEADERS) {
    const option = document.createElement("option");
    option.value = name;
    datalist.append(option);
  }
}

function renderRow(rule) {
  const row = template.content.firstElementChild.cloneNode(true);
  row.dataset.id = rule.id;
  row.classList.toggle("row--disabled", !rule.enabled);

  const enabled = row.querySelector("[data-field='enabled']");
  const operation = row.querySelector("[data-field='operation']");
  const header = row.querySelector("[data-field='header']");
  const value = row.querySelector("[data-field='value']");

  enabled.checked = rule.enabled;
  operation.value = rule.operation;
  header.value = rule.header;
  value.value = rule.value;
  applyOperationToValue(rule, value);

  return row;
}

// "remove" discards the header entirely, so a value would be meaningless.
function applyOperationToValue(rule, value) {
  const removing = rule.operation === "remove";
  value.disabled = removing;
  value.placeholder = removing ? "—" : "application/json";
}

function render() {
  list.replaceChildren(...rules.map(renderRow));
  empty.hidden = rules.length > 0;

  const active = rules.filter((rule) => rule.enabled).length;
  count.textContent = rules.length ? `${active} of ${rules.length} active` : "";
}

async function persist() {
  await saveRules(rules);
  // Apply immediately as well, so the rules take effect even if the service
  // worker is asleep when the popup closes.
  await applyRules(rules);
}

function findRule(element) {
  const id = element.closest(".row")?.dataset.id;
  return rules.find((rule) => rule.id === id);
}

list.addEventListener("input", async (event) => {
  const field = event.target.dataset.field;
  const rule = findRule(event.target);
  if (!field || !rule) return;

  if (field === "enabled") {
    rule.enabled = event.target.checked;
    event.target.closest(".row").classList.toggle("row--disabled", !rule.enabled);
    count.textContent = `${rules.filter((r) => r.enabled).length} of ${rules.length} active`;
  } else {
    rule[field] = event.target.value;
    if (field === "operation") {
      applyOperationToValue(rule, event.target.closest(".row").querySelector("[data-field='value']"));
    }
  }

  await persist();
});

list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='delete']");
  if (!button) return;

  const rule = findRule(button);
  rules = rules.filter((item) => item !== rule);
  render();
  await persist();
});

document.getElementById("add").addEventListener("click", async () => {
  rules.push(createRule());
  render();
  list.querySelector(".row:last-child [data-field='header']")?.focus();
  list.scrollTop = list.scrollHeight;
  await persist();
});

(async function init() {
  fillHeaderSuggestions();
  rules = await loadRules();
  render();
})();
