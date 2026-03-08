declare module "cloudflare:test" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type -- required by @cloudflare/vitest-pool-workers
  interface ProvidedEnv extends Record<string, string> {}
}
