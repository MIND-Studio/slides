"use client";

import { login } from "@inrupt/solid-client-authn-browser";
import {
  browserOidcLogin,
  clearLastIdentity,
  MindLoginCard,
  writeLastIdentity,
} from "@mind-studio/core";
import { Button } from "@mind-studio/ui";
import { useEffect, useState } from "react";
import { ensureSession, rememberReturnToDefault } from "@/lib/solid/auth";
import { DEFAULT_ISSUER, rememberIssuer, session } from "@/lib/solid/session";

const APP_NAME = "Slides";

export default function ConnectForm() {
  const [webId, setWebId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSession()
      .then((info) => {
        const id = info.webId ?? null;
        setWebId(id);
        if (id) {
          writeLastIdentity(APP_NAME, {
            webId: id,
            displayName: id.split("/").filter(Boolean).pop(),
          });
        }
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function onLogout() {
    await session().logout();
    clearLastIdentity(APP_NAME);
    setWebId(null);
  }

  if (webId) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Connected</p>
        <p className="mt-2 break-all font-mono text-sm" data-testid="webid">
          {webId}
        </p>
        <div className="mt-4 flex gap-3">
          <Button asChild>
            <a href="/studio">Open the studio →</a>
          </Button>
          <Button variant="outline" onClick={onLogout}>
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  const handleLogin = browserOidcLogin(login, {
    callbackPath: "/login/callback",
    clientName: "Mind Slides",
  });

  return (
    <>
      <MindLoginCard
        appName={APP_NAME}
        defaultIssuer={DEFAULT_ISSUER}
        onLogin={async ({ issuer }) => {
          rememberIssuer(issuer);
          rememberReturnToDefault("/studio");
          await handleLogin({ issuer });
        }}
      />
      {error && (
        <p className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
