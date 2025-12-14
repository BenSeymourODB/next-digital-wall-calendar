# React Compiler

The React Compiler is a build-time optimization tool that **automatically memoizes your React components and hooks**, eliminating the need for manual performance optimizations like `useMemo`, `useCallback`, and `React.memo`.

## What It Does

The React Compiler analyzes your React code during the build process and automatically inserts fine-grained memoization logic. This means:

- **No more manual memoization**: Write clean, simple React code without worrying about `useMemo`, `useCallback`, or `React.memo`
- **Automatic optimization**: The compiler intelligently determines what needs to be memoized based on component dependencies
- **Fine-grained reactivity**: Only re-renders what actually changed, preventing unnecessary child component updates
- **Zero runtime overhead**: Optimizations happen at build time, not at runtime

## Advantages for Developers

### 1. Simpler, Cleaner Code

- Remove boilerplate memoization code
- Reduce cognitive load when writing components
- Less code to maintain and debug

**Before (Manual Memoization):**

```javascript
const ExpensiveComponent = memo(function ExpensiveComponent({ data, onClick }) {
  const processedData = useMemo(() => {
    return expensiveProcessing(data);
  }, [data]);

  const handleClick = useCallback(
    (item) => {
      onClick(item.id);
    },
    [onClick]
  );

  return (
    <div>
      {processedData.map((item) => (
        <Item key={item.id} onClick={() => handleClick(item)} />
      ))}
    </div>
  );
});
```

**After (React Compiler):**

```javascript
function ExpensiveComponent({ data, onClick }) {
  const processedData = expensiveProcessing(data);

  const handleClick = (item) => {
    onClick(item.id);
  };

  return (
    <div>
      {processedData.map((item) => (
        <Item key={item.id} onClick={() => handleClick(item)} />
      ))}
    </div>
  );
}
```

### 2. Better Performance by Default

- Compiler applies optimizations more consistently than manual memoization
- No risk of missing memoization opportunities or incorrect dependency arrays
- Optimizes even after conditional returns and complex control flow

### 3. Fewer Bugs

- Eliminates common mistakes with dependency arrays
- No risk of stale closures from incorrect memoization
- Compiler enforces React's Rules automatically

### 4. Future-Proof Code

- Code written for the compiler is cleaner and more maintainable
- Optimizations improve as the compiler evolves
- Enables future React features that rely on fine-grained reactivity

## How It Works in This Project

This Next.js 16 template has React Compiler enabled via `next.config.ts`:

```typescript
experimental: {
  reactCompiler: true,
}
```

**Requirements:**

- Next.js 16+ (already configured)
- `babel-plugin-react-compiler` (already installed as dev dependency)
- React 19+ (already installed)

**Build-time behavior:**

- During `pnpm build`, the compiler analyzes all React components and hooks
- Automatically inserts memoization logic where beneficial
- No changes needed to your source code
- Works with both server and client components

## Compilation Modes

The compiler supports different compilation modes (configured via `compilationMode`):

### 1. `infer` (default)

Automatically compiles components and hooks based on naming conventions:

- Functions starting with uppercase (e.g., `Button`) that return JSX
- Functions starting with `use` (e.g., `useCounter`) that call hooks
- Functions with explicit `"use memo"` directive

### 2. `annotation`

Only compiles functions with explicit `"use memo"` directive:

- Useful for gradual adoption
- Maximum control over what gets optimized

### 3. `all`

Compiles all functions regardless of naming:

- Aggressive optimization mode
- May cause issues with non-React functions

## Opt-in/Opt-out Directives

**Opt-in** (force compilation):

```javascript
function MyComponent() {
  "use memo"; // Compiler will optimize this
  return <div>Hello</div>;
}
```

**Opt-out** (prevent compilation):

```javascript
function ProblematicComponent() {
  "use no memo"; // Compiler will skip this
  // Useful for debugging or components with side effects
  return <div>Content</div>;
}
```

## Debugging with ESLint

This project includes `eslint-plugin-react-hooks@latest` which provides **compiler-powered linting** to:

- Identify code patterns that prevent optimization
- Enforce React's Rules of Hooks
- Highlight potential issues before runtime

## Verification

To verify the compiler is working:

1. **Build your project**: `pnpm build`
2. **Check compiled output**: Look in `.next/static/chunks` for compiled code
3. **Look for compiler runtime imports**:

   ```javascript
   import { c as _c } from "react/compiler-runtime";
   ```

## Best Practices

1. **Write simple, clean React code** - Let the compiler handle optimization
2. **Remove manual memoization** - `useMemo`, `useCallback`, and `React.memo` are no longer needed
3. **Follow React's Rules** - The compiler assumes you follow React's rules (no side effects in render, etc.)
4. **Use directives sparingly** - Only use `"use memo"` or `"use no memo"` when absolutely necessary
5. **Test thoroughly** - While the compiler is stable, test your components after enabling it

## React Compiler vs Manual Memoization

| Aspect               | Manual Memoization     | React Compiler          |
| -------------------- | ---------------------- | ----------------------- |
| **Developer effort** | High (wrap everything) | None (automatic)        |
| **Code complexity**  | High (boilerplate)     | Low (clean code)        |
| **Bug risk**         | High (wrong deps)      | Low (compiler-enforced) |
| **Performance**      | Good (if done right)   | Better (consistent)     |
| **Maintenance**      | High (update deps)     | Low (automatic)         |

## Additional Resources

- [React Compiler Official Docs](https://react.dev/learn/react-compiler)
- [React Compiler Installation Guide](https://react.dev/learn/react-compiler/installation)
- [Compilation Modes](https://react.dev/reference/react-compiler/compilationMode)
- [Troubleshooting](https://react.dev/learn/react-compiler/debugging)
