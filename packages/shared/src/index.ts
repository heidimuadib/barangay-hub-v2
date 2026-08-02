/**
 * Reserved — intentionally empty (ADR-0007).
 *
 * Code moves here the day it has a SECOND consumer (the Slice 8 outbox
 * dispatcher is the first expected one). Nothing in Slice 0–2 is imported by
 * more than the web application, and relocating single-consumer modules would
 * be movement without benefit: every import would churn while the dependency
 * graph stayed identical.
 */
export {}
