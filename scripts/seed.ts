import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { seedDatabase } = await import("../src/lib/seed");
  const result = await seedDatabase();
  console.log(
    `Seeded project "${result.slug}" (${result.projectId}) idempotently.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed database:", err);
  process.exit(1);
});
