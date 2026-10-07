"use client";

import { useEffect, useState } from "react";

interface WalletButtonProps {
  compact?: boolean;
}

interface SolanaProvider {
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
  connect(): Promise<{ publicKey?: { toString(): string } | null }>;
  disconnect(): Promise<void>;
  on?: (event: "connect" | "disconnect", listener: () => void) => void;
  removeListener?: (event: "connect" | "disconnect", listener: () => void) => void;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
  }
}

export default function WalletButton({ compact = false }: WalletButtonProps) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const provider = window.solana;
    if (!provider) {
      queueMicrotask(() => setAvailable(false));
      return;
    }

    queueMicrotask(() => setAvailable(true));

    const handleConnect = () => {
      try {
        const pk = provider.publicKey?.toString?.() || null;
        setPublicKey(pk);
      } catch {
        setPublicKey(null);
      }
    };

    const handleDisconnect = () => setPublicKey(null);

    provider.on?.("connect", handleConnect);
    provider.on?.("disconnect", handleDisconnect);

    if (provider.isConnected) {
      queueMicrotask(handleConnect);
    }

    return () => {
      provider.removeListener?.("connect", handleConnect);
      provider.removeListener?.("disconnect", handleDisconnect);
    };
  }, []);

  const connect = async () => {
    const provider = window.solana;
    if (!provider) return window.open("https://phantom.app/", "_blank");

    try {
      setConnecting(true);
      const res = await provider.connect();
      const pk = res?.publicKey?.toString?.() || provider.publicKey?.toString?.() || null;
      setPublicKey(pk);
    } catch (err) {
      // user rejected or error
      console.error("Wallet connect error", err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    const provider = window.solana;
    try {
      await provider?.disconnect();
    } catch (err) {
      console.error("Wallet disconnect error", err);
      setPublicKey(null);
    }
  };

  if (available === false) {
    // Phantom not available
    return compact ? (
      <div className="mt-2 text-sm text-white/60">Install Phantom to connect</div>
    ) : (
      <a
        href="https://phantom.app/"
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-xs font-medium text-purple-100 transition hover:border-purple-300/40 hover:bg-purple-400/20"
      >
        Install Phantom
      </a>
    );
  }

  if (publicKey) {
    const shortKey = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
    return compact ? (
      <div>
        <p className="mt-2 text-sm font-medium text-white/80">{shortKey}</p>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 sm:block">Solana</div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-purple-300/15 bg-purple-400/10 px-3 py-2 text-sm text-purple-100">{shortKey}</div>
          <button
            onClick={disconnect}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // not connected yet
  return compact ? (
    <p className="mt-2 text-sm text-white/70">Not connected</p>
  ) : (
    <button
      onClick={connect}
      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-purple-100 hover:shadow-purple-300/10 disabled:cursor-wait disabled:opacity-60"
      disabled={connecting}
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
