/**
 * Custom ESLint rules for Application Insights usage
 * Enforces use of the unified logger instead of direct SDK imports
 */

/**
 * Rule: prefer-logger-over-console
 * Encourages using the unified logger instead of console.log in server-side code
 */
const preferLoggerOverConsole = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer using logger from @/lib/logger instead of console methods in server-side code",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      useLogger:
        "Use logger.{{method}}() from @/lib/logger instead of console.{{method}}() for better telemetry tracking.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to server-side files
    const isServerSide =
      filename.includes("/app/api/") ||
      filename.includes("/api/") ||
      filename.includes("middleware.ts") ||
      filename.includes("middleware.js") ||
      filename.includes(".server.ts") ||
      filename.includes(".server.js");

    if (!isServerSide) {
      return {};
    }

    let hasUseClientDirective = false;

    return {
      Program(node) {
        const firstStatement = node.body[0];
        if (
          firstStatement &&
          firstStatement.type === "ExpressionStatement" &&
          firstStatement.expression.type === "Literal" &&
          firstStatement.expression.value === "use client"
        ) {
          hasUseClientDirective = true;
        }
      },

      CallExpression(node) {
        // Skip if this is a client component
        if (hasUseClientDirective) {
          return;
        }

        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "console" &&
          node.callee.property.type === "Identifier"
        ) {
          const method = node.callee.property.name;
          const loggerMethod =
            method === "log"
              ? "info"
              : method === "info"
                ? "info"
                : method === "debug"
                  ? "debug"
                  : method === "warn"
                    ? "warn"
                    : method === "error"
                      ? "error"
                      : null;

          if (loggerMethod) {
            context.report({
              node,
              messageId: "useLogger",
              data: {
                method: loggerMethod,
              },
            });
          }
        }
      },
    };
  },
};

/**
 * Rule: no-direct-appinsights-client-import
 * Forbid any direct imports of @/lib/appinsights-client except from an allowlist.
 * Intent: force developers to use the unified logger instead of the raw SDK.
 */
const noDirectAppInsightsClientImport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct imports of @/lib/appinsights-client; use @/lib/logger instead",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noDirectImport:
        "Import Application Insights via '@/lib/logger' only. Do not import from @/lib/appinsights-client directly.",
    },
    schema: [],
  },

  create(context) {
    const filenameRaw = context.getFilename();
    const filename = filenameRaw.replace(/\\/g, "/"); // normalize for Windows paths

    // Allow only in these files (absolute or workspace-absolute paths endWith these)
    const allowedImporters = [
      "/src/lib/logger.ts",
      "/src/components/providers/AppInsightsProvider.tsx", // keep if provider initializes the client
    ];

    const isAllowed = allowedImporters.some((suffix) =>
      filename.endsWith(suffix)
    );

    const matchesClientModule = (source) =>
      typeof source === "string" &&
      (/^@\/lib\/appinsights-client$/.test(source) ||
        /\/lib\/appinsights-client(\.[tj]sx?)?$/.test(source));

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (matchesClientModule(source) && !isAllowed) {
          context.report({
            node,
            messageId: "noDirectImport",
          });
        }
      },
      // Also catch dynamic imports: import('.../appinsights-client')
      ImportExpression(node) {
        if (
          node.source &&
          node.source.type === "Literal" &&
          matchesClientModule(node.source.value) &&
          !isAllowed
        ) {
          context.report({
            node,
            messageId: "noDirectImport",
          });
        }
      },
    };
  },
};

/**
 * Rule: no-direct-appinsights-server-import
 * Forbid any direct imports of @/lib/appinsights-server except from an allowlist.
 * Intent: force developers to use the unified logger instead of the raw SDK.
 */
const noDirectAppInsightsServerImport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct imports of @/lib/appinsights-server; use @/lib/logger instead",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noDirectImport:
        "Import Application Insights via '@/lib/logger' only. Do not import from @/lib/appinsights-server directly.",
    },
    schema: [],
  },

  create(context) {
    const filenameRaw = context.getFilename();
    const filename = filenameRaw.replace(/\\/g, "/");

    // Only the logger should import the server SDK directly
    const allowedImporters = ["/src/lib/logger.ts"];
    const isAllowed = allowedImporters.some((suffix) =>
      filename.endsWith(suffix)
    );

    const matchesServerModule = (source) =>
      typeof source === "string" &&
      (/^@\/lib\/appinsights-server$/.test(source) ||
        /\/lib\/appinsights-server(\.[tj]sx?)?$/.test(source));

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (matchesServerModule(source) && !isAllowed) {
          context.report({
            node,
            messageId: "noDirectImport",
          });
        }
      },
      // Also catch dynamic imports: import('.../appinsights-server')
      ImportExpression(node) {
        if (
          node.source &&
          node.source.type === "Literal" &&
          matchesServerModule(node.source.value) &&
          !isAllowed
        ) {
          context.report({
            node,
            messageId: "noDirectImport",
          });
        }
      },
    };
  },
};

const plugin = {
  rules: {
    "prefer-logger-over-console": preferLoggerOverConsole,
    "no-direct-appinsights-client-import": noDirectAppInsightsClientImport,
    "no-direct-appinsights-server-import": noDirectAppInsightsServerImport,
  },
};

export default plugin;
