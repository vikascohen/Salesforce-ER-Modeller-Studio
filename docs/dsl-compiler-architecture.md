# The ER DSL Compiler Architecture

Author: Vikas Cohen  
Compiler Architect and System Designer

## 1. The philosophy behind the compiler

The ER DSL in this project is not a general-purpose programming language. It is a small, declarative schema language whose purpose is narrow and precise: define business objects and the relationships between them, then render those relationships as a diagram. Because the language is intentionally restricted, the implementation can be understood as a specialized compiler pipeline without pretending that it is a full classical compiler.

This document adopts the language of compiler architecture not because the system is formally equivalent to a textbook compiler, but because the conceptual structure is the same: input text is classified, interpreted, validated, converted into an internal model, and then emitted in one or more target representations.

The central design idea is modest but important:

- the source is a line-oriented DSL,
- the grammar is shallow and flat,
- semantic interpretation happens early,
- geometry is generated only after the meaning is known,
- the final product is diagram output rather than executable code.

This is a compiler in the broad architectural sense: it transforms a high-level description into a lower-level representation for rendering. It is not a compiler in the modern language-engineering sense of nested expressions, type inference, multiple optimization passes, or an explicit AST pipeline.

The implementation therefore makes an honest tradeoff:

- no elaborate token stream is built,
- no deep tree is constructed,
- no separate typed AST is required,
- validation is interleaved with parsing,
- the semantic model becomes the durable artifact.

This is a design philosophy of economy without loss of rigor.

## 2. Why the design is reusable

The design is reusable because the project separates concerns along natural compiler boundaries:

1. textual input,
2. syntactic recognition,
3. semantic normalization,
4. domain model construction,
5. geometry generation,
6. target rendering/export.

This separation is not abstract decoration. It is visible in the code organization:

- `parseEr()` performs recognition and early semantic work,
- the semantic model is a stable intermediate object,
- `buildErGeometry()` converts that model into diagram coordinates,
- exporters such as Mermaid and draw.io operate on the same underlying model.

This is the essence of compiler reusability: once the semantic model is correct, multiple back ends can consume it without duplicating logic.

This is especially important in a system that supports several outputs from a single source:

- the live canvas,
- Mermaid text export,
- draw.io XML export,
- rasterized PNG output.

A reusable architecture keeps the core semantics independent from presentation. The diagram geometry is not the source of truth; the semantic model is.

## 3. The compiler pipeline

The actual pipeline is simpler than a conventional compiler, but it follows the same conceptual flow.

```mermaid
flowchart TD
    A[Source Text<br/>DSL input] --> B[Line-based Lexer / Classifier]
    B --> C[Top-level Grammar Dispatch]
    C --> D[Semantic Normalization<br/>ensureEntity / ensureField]
    D --> E[Semantic Model<br/>{ entities, relationships }]
    E --> F[Geometry IR<br/>buildErGeometry()]
    E --> G[Mermaid Export<br/>buildMermaidErDiagram()]
    F --> H[Canvas Rendering]
    F --> I[draw.io XML Export]
    H --> J[PNG Rasterization]
    G --> K[Mermaid text target]
    I --> L[.drawio target]
    H --> M[Live SVG target]

    style A fill:#f9f,stroke:#333,stroke-width:1px
    style E fill:#cfe2f3,stroke:#333,stroke-width:1px
    style F fill:#d9ead3,stroke:#333,stroke-width:1px
    style G fill:#d9ead3,stroke:#333,stroke-width:1px
    style I fill:#d9ead3,stroke:#333,stroke-width:1px
```

This architecture is intentionally honest:

- the pool of domain terms is small,
- the grammar is flat,
- the semantic model is central,
- optional geometry is synthesized later,
- emitted artifacts are different views over the same underlying structure.

## 4. Main implementation modules

The architecture is implemented across a small set of closely related modules.

### 4.1 `erDiagramLogic.js`

This is the compiler core. It owns the parser, semantic model construction, and the essential domain logic. It is the closest analog to the front end and middle end of a normal compiler.

### 4.2 `diagramStudio.js`

This provides the application host. It feeds raw DSL text into the parser and receives the semantic model and diagram data used by the editor and runtime canvas.

### 4.3 `buildErGeometry()`

This produces the intermediate representation for visual rendering. It converts model-level entities and relationships into pixel geometry:

- boxes,
- connector routes,
- lane assignments,
- self-loop paths,
- canvas bounds.

This is the equivalent of a machine- or target-specific intermediate representation.

### 4.4 Export generators

The project generates multiple outputs from the same semantic state:

- Mermaid text generation
- draw.io XML generation
- SVG drawing on the live canvas
- PNG export through a separate rasterization step

Each export has a different target grammar, but they all depend upon the same parsed semantics.

## 5. What a compiler does in this domain

A compiler in this domain does not compute arbitrary programs. It compiles a declarative object model into a visual graph. In practical terms, it does four things:

1. reads source text,
2. recognizes entity and relationship declarations,
3. resolves them into a normalized semantic model,
4. emits diagram-oriented output for a display or export backend.

This form of compilation is formally simpler than typical compilers, but it still exhibits all of the essential compiler concerns:

- recognition of legal syntax,
- tracking of names and identities,
- semantic normalization,
- structure building,
- validation,
- target-specific translation.

The architectural value is that the same semantic core can support many different renderers.

## 6. Lexical analysis: scanning the text

The language is line-oriented. There is no large token stream in the classic compiler sense. Instead, the implementation scans source text line by line and classifies each line as one of the few recognized categories:

- entity declaration,
- relationship declaration,
- blank line,
- comment.

The relevant logic is intentionally lightweight because the grammar is intentionally shallow.

The parser effectively performs lexing and parsing in one step. For example, entity declarations are recognized with a regex such as:

```js
const entityMatch = line.match(/^entity\s+(\w+)\s*(:\s*(.*))?$/i);
```

Relationship declarations are recognized with a second pattern:

```js
const relMatch = line.match(/^(\w+)\.(\w+)\s*(=>|~>|->)\s*(\w+)\s*$/);
```

This is not a “fake” lexer in the sense of being unprincipled. It is a deliberate design choice: the DSL has no nested grammar, no multi-line expression rules, and no need for a full token stream. The source text is already naturally segmented into declarations, so a line classifier is sufficient and more direct.

The important compiler lesson is that lexical analysis should match the language’s real structure. When the language is flat and line-based, there is no value in fabricating a heavy token lattice.

## 7. Indentation and tree construction

This chapter is deliberately not applicable in the current ER DSL.

A compiler that relies on indentation for structure requires a grammar where blocks, scope, and nesting are meaningful. This DSL does not. There are no nested declarations, no block scopes, and no indentation-sensitive semantics. The parser does not build a tree to represent statement nesting because there is no nesting to represent.

Therefore, neither of the following patterns is used:

- indentation-based parsing,
- AST construction for nested blocks.

The architecture is intentionally flatter than a general-purpose language compiler. The absence of tree construction is not a deficiency; it reflects the true shape of the problem.

## 8. Grammar and top-level dispatch

The grammar is best described as a small top-level dispatch system.

Each line is processed by a very narrow set of recognizers:

- entity pattern,
- relationship pattern,
- blank/comment pattern,
- otherwise, parse error.

This is a top-level grammar, not a recursive grammar. The top-level symbol is the declaration line itself.

This gives the implementation a highly readable structure:

- if the line matches an entity declaration, handle it,
- else if it matches a relationship declaration, handle it,
- else if the line is empty or commented, ignore it,
- else produce a diagnostic.

The dispatch is intentionally simple because the language intentionally has almost no syntactic complexity.

## 9. Recursive descent parsing for conditions

This chapter is not applicable to the current DSL.

The project does not parse arbitrary boolean expressions, nested predicates, or condition trees as part of the ER schema language. There is no condition grammar in the source language itself. The semantic work is about entity names, field names, relationship targets, source labels, and visualization metadata.

In other words, the present DSL does not need recursive descent for boolean expression parsing; it needs a compact declarative parser for flat declarations. A recursive-descent condition parser would be architectural overkill for this domain.

## 10. Name resolution and symbol tables

This is one of the most important compiler-like parts of the implementation.

The parser maintains a symbol table-like map of entities, indexed case-insensitively. The relevant semantic operation is conceptually equivalent to symbol resolution in a compiler front end.

The helper pattern is simple but significant:

```js
const ensureEntity = (name) => {
  const key = name.toLowerCase();
  if (!entities.has(key)) entities.set(key, { name, fields: [] });
  return entities.get(key);
};
```

This does several things:

- normalizes entity names,
- ensures identity is stable across repeated mentions,
- handles forward references,
- allows implicit creation of referenced but undeclared entities.

This is semantic work, not mere bookkeeping. The system resolves `Account` and `account` to the same entity and treats a target entity seen only in a relationship as a valid object with an empty field list unless explicitly declared otherwise.

This is the compiler’s symbol table logic at work, despite the absence of an explicit symbol table abstraction in the code.

## 11. Stateful interpretation and safe mutation

The semantic model is built incrementally. As each line is parsed, the system mutates the current entity map and relationship list. This is a form of stateful interpretation.

This design is safe because the language is simple and the state is well scoped:

- all entities live in a single map,
- fields are appended and normalized consistently,
- duplicate relationship declarations are discarded,
- the parser never has to “undo” work in the middle of the language run.

The important point is that the compiler is not a pure function over text in the strict theoretical sense. It is a stateful parser that accumulates a semantic environment while processing a sequence of declarations.

This is an appropriate design for a limited DSL because the semantics are monotonic: new declarations add information, they do not invalidate earlier declarations in a complex way.

## 12. Intermediate representation and step generation

The semantic model is the primary artifact, but the rendering pipeline also requires a geometry-oriented intermediate representation.

The geometry builder, `buildErGeometry()`, takes the model and produces data that the model itself does not know about:

- box positions,
- box sizes,
- connector paths,
- lane assignments,
- self-loop geometry,
- canvas dimensions.

This is the IR in the academic sense: the representation used to prepare the program for code generation to a visual target.

The geometry step is not universally required. For example, Mermaid generation works directly from the semantic model because Mermaid arranges layout itself. The canvas and draw.io exporters, however, do require the geometry IR.

This is a strong example of a compiler architecture with multiple back ends: one shared semantic model, one optional IR, several target-specific code generators.

## 13. Semantic validation and domain-aware checks

The parser enforces domain-specific semantics in addition to syntactic recognition.

Examples include:

- matching entity names case-insensitively,
- creating missing parent entities implicitly,
- preserving field metadata such as data type labels and flags,
- rejecting unrecognized top-level forms,
- deduplicating exact duplicate relationships.

This is not generic compiler validation like type-checking a JavaScript-like language. It is domain-aware validation within the ER schema model:

- field names must be semantically resolved in the current object universe,
- relationship entries must map to real entities,
- relationship lines are unique at the semantic level,
- target rendering assumes legal relationship kinds.

This makes the system more like a compact domain compiler than a general-purpose language front end.

## 14. User conditions vs record criteria: two expression languages

This chapter is not applicable to the current ER DSL.

The present source language represents declarations, not conditional logic. There is no expression language for user conditions, record filters, or query predicates in the DSL itself. Therefore, this compiler does not need a second expression grammar, no separate condition evaluator, and no specialized AST for logical composition.

This is one of the clearest indicators that the system is a domain-specific schema compiler rather than a general runtime language.

## 15. Applying steps and graph expansion

This chapter is not applicable to the current architecture.

There are no rule-based step application semantics or graph expansion phases within the DSL itself. The compiler does not evaluate a program step by step or expand a graph via sequential execution. It compiles declarations into a static object graph and then renders it. This is a declarative model, not a procedural or operational intermediate representation.

## 16. Access calculation and analysis

This chapter is not applicable in the present project.

The current design does not compute access control, privilege analysis, or authorization graphs. It does not analyze a record system for reachability or permission propagation. The compiler’s domain is a visual schema of relationships, not a policy or security model.

## 17. Optimization and performance thinking

Optimization is modest but real. It is not a classic multi-pass optimization pipeline because the language is too simple for that.

The closest analogues are:

- deduplication of exact duplicate relationship lines,
- lane fan-out for overlapping connectors,
- bounds clamping to keep geometry within the canvas,
- reduction of visual congestion in dense relationship layouts.

These are not traditional compiler optimizations in the sense of dead-code elimination or constant folding; they are rendering heuristics. But they fit the same conceptual role: they improve the quality and tractability of the final output without changing the semantics.

This is a valuable compiler lesson: for small domain languages, optimization often becomes layout and presentation strategy rather than arithmetic or code-motion optimization.

## 18. Diagnostics and error recovery

The compiler keeps diagnostics simple but useful. Because the grammar is small and the parser is mostly top-level dispatch, the failure modes are straightforward:

- unrecognized line,
- malformed entity declaration,
- malformed relationship declaration,
- inconsistent semantic references.

The documentation explicitly notes that an unrecognized line raises a parse error naming the line number. This is good compiler hygiene: the user sees the exact point of failure without requiring a large diagnostic framework.

The design avoids elaborate recovery because the language is flat and deterministic. The parser does not need deep backtracking or speculative parsing to remain robust.

## 19. The “code generation model” in DSL

Even though the target is a diagram rather than executable code, the project still follows the code generation model.

There are multiple code-generation paths, each with different constraints:

- Mermaid export requires identifier-safe names and target type tokens,
- draw.io export writes XML with HTML label content,
- the canvas renders SVG directly from geometry structures,
- PNG export is an additional rasterization step, not part of the core pipeline itself.

This is exactly what a compiler does when translating the same semantic model into different target grammars. The semantics stay stable; the target constraints vary.

The distinction matters because the same label may need different treatment depending on the target:

- the semantics are shared,
- the target syntax differs,
- the translation rules reflect that target grammar.

This is one of the strongest examples of sound language architecture in the project.

## 20. Editor integration and language services

The compiler is not isolated from the editor. It is integrated into an interactive system that provides language assistance.

The editor includes features such as:

- autocomplete for entity and field names,
- relationship field suggestions,
- arrow completion,
- object suggestions,
- semantic linter hints,
- import-based schema generation.

This is classic language service behavior: the parser and semantic model are used not only for final output, but also for user assistance in real time.

This is an important architectural point: the compiler is not merely a batch translator. It is a live editing substrate that powers the user experience.

## 21. Testing the compiler properly

A compiler is only credible if its behavior is tested at correct abstraction layers.

This project’s architecture supports testing at several levels:

- parser recognition tests,
- semantic model tests,
- geometry layout tests,
- export generation tests,
- end-to-end diagram rendering tests.

The test suite for `erDiagramLogic.js` is the most important evidence that the compiler core remains correct as the system evolves. A compiler should be tested against both the grammar and the semantic meaning, not just against visual output.

This is one of the most important engineering practices in language design: if the semantics are correct, the rendering targets are easier to trust.

## 22. Complete example end-to-end

Consider the following source:

```text
entity Account : Name, AnnualRevenue[Currency]
Contact.AccountId -> Account
```

This traverses the system in the following way:

1. The source text is read as two lines.
2. The first line matches the entity declaration pattern.
3. The second line matches the relationship declaration pattern.
4. `ensureEntity()` creates or reuses the `Account` entity.
5. `ensureField()` creates the `AccountId` relationship field on `Contact`.
6. The semantic model is built as a normalized object graph.
7. `buildErGeometry()` positions the relevant boxes and connector.
8. The rendered output proceeds through the chosen export backend.

This is a complete compiler flow in miniature. It is not a large compiler, but it is a real one in architecture and purpose.

## 23. Extending the language

The language is intentionally simple, which makes it easy to extend without destabilizing the architecture.

Extensions should be added in the same order as the compiler pipeline:

1. syntax recognition,
2. semantic normalization,
3. model shape update,
4. geometry / visual representation,
5. export translation,
6. tests.

Examples include:

- new field annotations,
- new relationship kinds,
- additional export targets,
- richer visual metadata,
- better diagnostics.

The most important rule is that the semantic model must be updated before the renderer is extended. That preserves the compiler’s integrity.

## 24. Current limitations and future improvements

The current system is intentionally limited, and that is a feature rather than a flaw.

Its current constraints include:

- flat, line-based grammar,
- no nested conditions or expressions,
- no separate type system,
- no elaborate optimization pipeline,
- no extensive recovery strategy.

Future improvements could include:

- richer semantic validation,
- stronger source diagnostics,
- multi-pass verification for imported schema data,
- richer code generation for additional targets,
- a more explicit IR definition and documentation.

The key point is that these improvements would add power without changing the architecture’s fundamental shape.

## 25. Final architecture summary

The ER DSL implementation is best understood as a compact, domain-specific compiler with a deliberately reduced architecture.

It contains the core ingredients of a compiler pipeline:

- lexical recognition,
- parsing,
- symbol resolution,
- semantic model construction,
- intermediate representation,
- target generation,
- diagnostics.

It omits the features that do not apply to the problem domain:

- deep ASTs,
- nested expressions,
- full type systems,
- dedicated optimization passes,
- general-purpose runtime semantics.

This is not a weakness. It is a disciplined architectural choice.

## 26. Design principles every compiler author can reuse

Several design principles are directly reusable beyond this project:

1. Match the architecture to the problem.
   Do not build a full compiler pipeline if the language is flat and limited.

2. Keep the semantic model authoritative.
   Renderers and exporters should consume a shared model, not competing versions of the truth.

3. Use a lightweight front end when the grammar is simple.
   Regex-based recognition and line classification are not “cheating” when they faithfully fit the language.

4. Separate syntax from semantics.
   Recognition is not the same as meaning. The compiler should normalize and validate early.

5. Prefer stable intermediate artifacts over ad hoc mutations.
   Once a semantic model exists, many back ends become easy to support.

6. Design targets around grammar differences.
   Every backend has its own constraints; translation rules should reflect them.

7. Test the compiler at the semantic layer.
   Visual output is useful, but semantic correctness is the true source of trust.

## 27. Closing thought

The ER DSL is a small compiler, but it is not a toy in the pejorative sense. It is a carefully designed translation system whose power comes from constraint, clarity, and intentional simplicity.

It demonstrates an enduring compiler principle: a system does not need to imitate the complexity of a general-purpose language ecosystem in order to benefit from compiler architecture. The right architecture is the one that matches the structure of the language and the needs of the domain.

That is the core lesson of this project.

Vikas Cohen  
Compiler Architect and System Designer

---

This document reflects the compiler-style architecture used in the ER DSL implementation, as a conceptual model for understanding how the source DSL is transformed into diagram output and export artifacts.
