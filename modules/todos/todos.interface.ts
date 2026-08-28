/**
 * The public contract for the `todos` module (docs/ARCHITECTURE_DESIGN.md §2.1).
 * Pages and components import from here only - never from todos.repository.ts
 * or todos.service.ts directly, and never call `supabase.from("todos")` themselves.
 */
export { todosService as todosInterface } from "./todos.service";
export type { TodoDTO } from "./todos.dto";
export type { TodoInput } from "@/types/todo";
