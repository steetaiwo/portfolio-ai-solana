"use client";

import { useEffect, useState } from "react";

interface WalletButtonProps {
  compact?: boolean;
}

export default function WalletButton({ compact = false }: WalletButtonProps) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const provider = (window as any).solana;
    if (!provider) {
      setAvailable(false);
      return;
    }

    setAvailable(true);

    const handleConnect = () => {
      try {
        const pk = provider.publicKey?.toString?.() || null;
        setPublicKey(pk);
      } catch {
        setPublicKey(null);
      }
    };

    const handleDisconnect = () => setPublicKey(null);

    provider.on && provider.on("connect", handleConnect);
    provider.on && provider.on("disconnect", handleDisconnect);

    if (provider.isConnected) {
      handleConnect();
    }

    return () => {
      provider?.removeListener && provider.removeListener("connect", handleConnect);
      provider?.removeListener && provider.removeListener("disconnect", handleDisconnect);
    };
  }, []);

  const connect = async () => {
    const provider = (window as any).solana;
    if (!provider) return window.open("https://phantom.app/," , "_blank");

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
    const provider = (window as any).solana;
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
        className="rounded-full border border-white/10 bg-purple-400/10 px-4 py-2 text-xs text-purple-200 hover:bg-purple-400/20"
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
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">Solana</div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-purple-400/10 px-3 py-2 text-sm text-purple-200">{shortKey}</div>
          <button
            onClick={disconnect}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50"
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
      className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black"
      disabled={connecting}
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
