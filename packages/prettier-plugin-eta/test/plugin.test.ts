import assert from "node:assert/strict";
import test from "node:test";

import * as prettier from "prettier";

import { formatExpressionSourceInline } from "../src/format-js.js";
import plugin from "../src/index.js";

async function formatEta(source: string, options: Record<string, unknown> = {}): Promise<string> {
  return prettier.format(source, {
    parser: "eta-template",
    plugins: [plugin],
    ...options
  });
}

test("formats interpolation and surrounding html", async () => {
  const result = await formatEta("<div><%=foo +bar%></div>");
  assert.equal(result, "<div><%= foo + bar %></div>\n");
});

test("formats control flow blocks and nested html", async () => {
  const source = "<ul><% for(const item of items){ %><li><%=item.name%></li><% } %></ul>";
  const result = await formatEta(source);
  assert.equal(result, "<ul>\n  <% for (const item of items) { %>\n  <li><%= item.name %></li>\n  <% } %>\n</ul>\n");
});

test("keeps percent-close inside javascript strings safe", async () => {
  const result = await formatEta('<% const marker = "%>"; %>');
  assert.equal(result, '<% const marker = "%>"; %>\n');
});

test("formats template literal output without breaking interpolation", async () => {
  const result = await formatEta("<%=`Hello ${ user.name }`%>");
  assert.equal(result, "<%= `Hello ${user.name}` %>\n");
});

test("formats trim markers in canonical eta form", async () => {
  const result = await formatEta("<div><%-=it.name-%></div>");
  assert.equal(result, "<div><%-= it.name -%></div>\n");
});

test("normalizes comment tag whitespace", async () => {
  const result = await formatEta("<%#   keep   this   note   %>");
  assert.equal(result, "<%# keep this note %>\n");
});

test("preserves empty comment tags without inserting padding", async () => {
  const result = await formatEta("<%#%>");
  assert.equal(result, "<%#%>\n");
});

test("can skip html formatting while still formatting eta tags", async () => {
  const result = await formatEta("<div>  <%=foo%></div>", {
    etaFormatHtml: false
  });
  assert.equal(result, "<div>  <%= foo %></div>\n");
});

test("preserves literal text that resembles a slot placeholder", async () => {
  const result = await formatEta("<div>ETATAGSLOT0TOKEN <%= foo %></div>");
  assert.equal(result, "<div>ETATAGSLOT0TOKEN <%= foo %></div>\n");
});

test("preserves whitespace inside string, regex, and template literals", async () => {
  const source = [
    '<% const text = "hello   world"; %>',
    "<% const pattern = /hello   world/g; %>",
    "<%= `line1",
    "  line2` %>",
    '<% layout("./my  path") %>'
  ].join("\n");

  const result = await formatEta(source, {
    trailingComma: "all"
  });

  assert.equal(
    result,
    [
      '<% const text = "hello   world"; %>',
      "<% const pattern = /hello   world/g; %>",
      "<%=",
      "`line1",
      "  line2`",
      "%>",
      '<% layout("./my  path"); %>',
      ""
    ].join("\n")
  );
});

test("formats eta line comments without breaking idempotence", async () => {
  const firstPass = await formatEta("<% // note %>");
  const secondPass = await formatEta(firstPass);

  assert.equal(firstPass, "<% // note %>\n");
  assert.equal(secondPass, firstPass);
});

test("preserves adjacent tag line breaks", async () => {
  const result = await formatEta("<%# a comment %>\n<%= foo %>\n");
  assert.equal(result, "<%# a comment %>\n<%= foo %>\n");
});

test("preserves trim-controlled content blocks across Eta tags", async () => {
  const result = await formatEta("<%- if (x) { -%>\nhi\n<%- } -%>");
  assert.equal(result, "<%- if (x) { -%>\nhi\n<%- } -%>\n");
});

test("dedents multiline execution blocks after formatting", async () => {
  const result = await formatEta("<% const a = 1; const b = 2; const c = 3 %>", {
    printWidth: 40
  });

  assert.equal(result, ["<%", "const a = 1;", "const b = 2;", "const c = 3;", "%>", ""].join("\n"));
});

test("keeps multiline execution arrays aligned without wrapper indentation drift", async () => {
  const result = await formatEta(
    "<% someVeryLongArray = [firstValue, secondValue, thirdValue, fourthValue, fifthValue] %>",
    {
      printWidth: 40,
      trailingComma: "all"
    }
  );

  assert.equal(
    result,
    [
      "<%",
      "someVeryLongArray = [",
      "  firstValue,",
      "  secondValue,",
      "  thirdValue,",
      "  fourthValue,",
      "  fifthValue,",
      "];",
      "%>",
      ""
    ].join("\n")
  );
});

test("dedents multiline expression fragments after formatting", async () => {
  const result = await formatEta("<%= it.user.profile.name.toUpperCase().trim().replace('_', ' ') %>", {
    printWidth: 40
  });

  assert.equal(
    result,
    ["<%=", "it.user.profile.name", "  .toUpperCase()", "  .trim()", '  .replace("_", " ")', "%>", ""].join("\n")
  );
});

test("preserves division after javascript comments inside eta tags", async () => {
  const result = await formatEta("<%= total /* normalize */ / count %>");
  assert.equal(result, "<%= total /* normalize */ / count %>\n");
});

test("preserves postfix increment expressions before division inside eta tags", async () => {
  const result = await formatEta("<%= x++ / 2 %>");
  assert.equal(result, "<%= x++ / 2 %>\n");
});

test("preserves postfix decrement statements before division inside eta tags", async () => {
  const result = await formatEta("<% let y = x-- / 2; %>");
  assert.equal(result, "<% let y = x-- / 2; %>\n");
});

test("extracts wrapped expressions without depending on the last semicolon in the document", async () => {
  const result = await formatEta("<%= foo /* trailing ; */ %>");
  assert.equal(result, "<%= foo /* trailing ; */ %>\n");
});

test("formats markdown eta templates without reflowing markdown tables", async () => {
  const source = [
    "# Configuration",
    "",
    "> Auto-generated for <%=it.service%>",
    "",
    "| Key | Value |",
    "| --- | --- |",
    "<% for (const item of items) { %>",
    "| <%=item.key%> | <%=item.value%> |",
    "<% } %>"
  ].join("\n");

  const result = await formatEta(source, {
    filepath: "/tmp/configuration.md.eta",
    printWidth: 120,
    proseWrap: "preserve"
  });

  assert.equal(
    result,
    [
      "# Configuration",
      "",
      "> Auto-generated for <%= it.service %>",
      "",
      "| Key | Value |",
      "| --- | --- |",
      "<% for (const item of items) { %>",
      "| <%= item.key %> | <%= item.value %> |",
      "<% } %>",
      ""
    ].join("\n")
  );
});

test("preserves markdown tables and fenced code blocks in markdown eta templates", async () => {
  const source = [
    "---",
    'title: "Configuration for <%= it.meta.service %>"',
    "---",
    "",
    "| Category | Variables | Description |",
    "|----------|-----------|-------------|",
    "<% for (const [category, vars] of Object.entries(it.categories)) { -%>",
    "| <%= category %> | <%= vars.length %> | <%= it.categoryDescriptions[category] || 'Configuration settings' %> |",
    "<% } -%>",
    "",
    "```bash",
    "# Redis",
    "REDIS_HOST=localhost",
    "APP_NAME=<%= it.meta.service %>",
    "```",
    "",
    "## Next",
    "",
    "Done.",
    ""
  ].join("\n");

  const result = await formatEta(source, {
    filepath: "/tmp/configuration.md.eta",
    printWidth: 120,
    proseWrap: "preserve"
  });
  const secondPass = await formatEta(result, {
    filepath: "/tmp/configuration.md.eta",
    printWidth: 120,
    proseWrap: "preserve"
  });

  assert.equal(
    result,
    [
      "---",
      'title: "Configuration for <%= it.meta.service %>"',
      "---",
      "",
      "| Category | Variables | Description |",
      "|----------|-----------|-------------|",
      "<% for (const [category, vars] of Object.entries(it.categories)) { -%>",
      '| <%= category %> | <%= vars.length %> | <%= it.categoryDescriptions[category] || "Configuration settings" %> |',
      "<% } -%>",
      "",
      "```bash",
      "# Redis",
      "REDIS_HOST=localhost",
      "APP_NAME=<%= it.meta.service %>",
      "```",
      "",
      "## Next",
      "",
      "Done.",
      ""
    ].join("\n")
  );
  assert.equal(secondPass, result);
});

test("preserves standalone eta control line indentation in nested html", async () => {
  const source = [
    '<template x-if="!<%= it.flag %>">',
    "  <span>",
    "    <% if (it.icon) { %>",
    '    <i class="fa fa-<%= it.icon %>"></i>',
    "    <% } %>",
    "<% if (it.labelExpr) { %>",
    '    <span x-text="<%= it.labelExpr %>"></span>',
    "    <% } else if (it.labelKey) { %>",
    '    <span x-text="<%= it.tFn || \"$t\" %>(\'<%= it.labelKey %>\')"></span>',
    "    <% } %>",
    "  </span>",
    "</template>",
    ""
  ].join("\n");

  const result = await formatEta(source, {
    printWidth: 120
  });

  assert.equal(
    result,
    [
      '<template x-if="!<%= it.flag %>">',
      "  <span>",
      "    <% if (it.icon) { %>",
      '    <i class="fa fa-<%= it.icon %>"></i>',
      "    <% } %>",
      "    <% if (it.labelExpr) { %>",
      '    <span x-text="<%= it.labelExpr %>"></span>',
      "    <% } else if (it.labelKey) { %>",
      '    <span x-text="<%= it.tFn || \"$t\" %>(\'<%= it.labelKey %>\')"></span>',
      "    <% } %>",
      "  </span>",
      "</template>",
      ""
    ].join("\n")
  );
});

test("keeps standalone eta close tags aligned with their block instead of the body", async () => {
  const source = [
    "<div>",
    "  <% if (it.ready) { %>",
    "    <span>ready</span>",
    "  <% } else { %>",
    "    <span>pending</span>",
    "  <% } %>",
    "</div>",
    ""
  ].join("\n");

  const result = await formatEta(source, {
    printWidth: 120
  });

  assert.equal(
    result,
    [
      "<div>",
      "  <% if (it.ready) { %>",
      "  <span>ready</span>",
      "  <% } else { %>",
      "  <span>pending</span>",
      "  <% } %>",
      "</div>",
      ""
    ].join("\n")
  );
});

test("keeps standalone raw output tags inline when the source expression was inline", async () => {
  const source = [
    "<table>",
    '  <%~ include("/partials/_thead", { cols: it.tables.history.columns }) %>',
    "</table>",
    ""
  ].join("\n");

  const result = await formatEta(source, {
    printWidth: 80
  });

  assert.equal(
    result,
    ["<table>", '  <%~ include("/partials/_thead", { cols: it.tables.history.columns }) %>', "</table>", ""].join("\n")
  );
});

test("wraps long html start tags that contain embedded eta attributes", async () => {
  const source = [
    "<thead><tr>",
    "<% for (const col of it.cols) { %>",
    // Deliberately keeps the unescaped \"$t\" attribute fragment as Eta template syntax.
    // This is a fragile HTML-parser edge case and the expected layout may need updating
    // if Prettier changes how it tokenizes malformed-but-tolerated attribute values.
    '  <th<% if (col.w) { %> style="width:<%= col.w %>"<% } %><% if (col.i18n) { %> x-text="<%= it.tFn || "$t" %>(\'<%= col.i18n %>\')"<% } %><% if (col.cls) { %> class="<%= col.cls %>"<% } %>></th>',
    "<% } %>",
    "</tr></thead>",
    ""
  ].join("\n");

  const result = await formatEta(source, {
    printWidth: 120
  });

  assert.equal(
    result,
    [
      "<thead><tr>",
      "  <% for (const col of it.cols) { %>",
      "  <th",
      '    <% if (col.w) { %> style="width:<%= col.w %>"<% } %>',
      '    <% if (col.i18n) { %> x-text="<%= it.tFn || "$t" %>(\'<%= col.i18n %>\')"<% } %>',
      '    <% if (col.cls) { %> class="<%= col.cls %>"<% } %>></th>',
      "  <% } %>",
      "</tr></thead>",
      ""
    ].join("\n")
  );
});

test("does not split eta tags in html attributes at percent-close inside string literals", async () => {
  const source = [
    '<div class="very-long-class-name"<% if (it.pattern) { %> data-pattern="<%= \'%> marker\' %>"<% } %> data-state="ready"></div>',
    ""
  ].join("\n");

  const result = await formatEta(source, {
    printWidth: 80
  });
  const secondPass = await formatEta(result, {
    printWidth: 80
  });

  assert.match(result, /data-pattern="<%= ["']%> marker["'] %>"/);
  assert.equal(secondPass, result);
});

test("does not treat markdown lines with logical-or operators as table rows", async () => {
  const source = ["# Notes", "", "<% const value = left || right %>", "| --- | --- |", "| key | value |", ""].join(
    "\n"
  );

  const result = await formatEta(source, {
    filepath: "/tmp/notes.md.eta",
    printWidth: 120,
    proseWrap: "preserve"
  });

  assert.equal(
    result,
    ["# Notes", "", "<% const value = left || right; %>", "| --- | --- |", "| key | value |", ""].join("\n")
  );
});

test("preserves whitespace inside literals when formatting inline expressions", async () => {
  const result = await formatExpressionSourceInline('"a  b" || /x  y/.source || `c  d`', {
    printWidth: 120
  });

  assert.equal(result, '"a  b" || /x  y/.source || `c  d`');
});

test("respects trailingComma none for multi-line include expressions", async () => {
  const source = [
    "<%~",
    '  include("/partials/_import-history-table", {',
    "    ...it,",
    '    tableId: "ems-history-table",',
    '    bodyId: "ems-modal-history-body",',
    '    extraClass: ""',
    "  })",
    "%>"
  ].join("\n");

  const resultNone = await formatEta(source, { trailingComma: "none" });
  assert.ok(!resultNone.includes('extraClass: "",'), "trailingComma none should not add trailing comma");

  const resultAll = await formatEta(source, { trailingComma: "all" });
  assert.ok(resultAll.includes('extraClass: "",'), "trailingComma all should add trailing comma");
});

test("forwards htmlWhitespaceSensitivity ignore to suppress inline hug patterns", async () => {
  // The plugin itself does not set a default for htmlWhitespaceSensitivity —
  // the extension defaults to "ignore". Without the option, Prettier uses its
  // own default ("css"), which produces the hug pattern tested in the first
  // assertion below.
  const source = [
    '<template x-if="triggering">',
    '  <span><i class="fa fa-spinner"></i> <span x-text="$t(\'ems.import_modal.triggering\')"></span></span>',
    "</template>"
  ].join("\n");

  const resultCss = await formatEta(source, { printWidth: 80, htmlWhitespaceSensitivity: "css" });
  assert.ok(resultCss.includes("><i"), "css mode should produce hug pattern for inline elements");

  const resultIgnore = await formatEta(source, { printWidth: 80, htmlWhitespaceSensitivity: "ignore" });
  assert.ok(!resultIgnore.includes("><i"), "ignore mode should eliminate hug pattern");
  assert.ok(resultIgnore.includes('<i class="fa fa-spinner"></i>'), "ignore mode should keep inline content intact");
});

test("rejects malformed eta tags", async () => {
  await assert.rejects(() => formatEta("<% if (enabled) { "), /Unterminated Eta tag/);
});

test("remains idempotent across the sample eta corpus", async () => {
  const cases = [
    "<% if (enabled) { %><div><%= it.name %></div><% } %>",
    "<% // note %>",
    "<% } else if (it.ready) { %>",
    "<% const value = { foo: [1, 2, 3] } %>",
    "<% someVeryLongArray = [firstValue, secondValue, thirdValue, fourthValue, fifthValue] %>",
    "<div><%-=it.name-%></div>"
  ];

  for (const source of cases) {
    const once = await formatEta(source, { printWidth: 40, trailingComma: "all" });
    const twice = await formatEta(once, { printWidth: 40, trailingComma: "all" });
    assert.equal(twice, once, `formatter should be idempotent for ${source}`);
  }
});
