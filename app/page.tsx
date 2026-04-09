import { OS } from "@/components/OS";
import { Landing } from "@/components/landing/Landing";
import { AccessGate } from "@/components/AccessGate";
import { FlagsProvider } from "@/flags/context";
import { getFlagsForUser } from "@/flags/flags";
import { ActionsProvider } from "@/lib/actions/ActionsProvider";
import { login, logout } from "@/lib/auth/actions";
import { getUser } from "@/lib/auth/getUser";
import { isLocal } from "@/lib/isLocal";
import { hasDatabase } from "@/lib/db";
import { cookies } from "next/headers";

export default async function Home() {
  const user = await getUser();

  // In local mode with a database, require access code
  if (isLocal() && hasDatabase()) {
    const cookieStore = await cookies();
    const session = cookieStore.get("lr_session")?.value;
    if (!session) {
      return <AccessGate />;
    }
  }

  return (
    <FlagsProvider flags={getFlagsForUser(user)}>
      <ActionsProvider actions={{ login, logout }}>
        {user || isLocal() ? <OS /> : <Landing />}
      </ActionsProvider>
    </FlagsProvider>
  );
}
