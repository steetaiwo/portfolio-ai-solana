import WalletButton from "./components/WalletButton";
import PortfolioOverview from "./components/PortfolioOverview";
import AIInsights from "./components/AIInsights";

export default function Home() {
	return (
		<main className="min-h-screen bg-[#08070c] text-white">
			<div className="flex min-h-screen">
				{/* Sidebar */}
				<aside className="hidden w-64 border-r border-white/10 bg-[#0b0a10] p-6 md:block">
					<div className="mb-10">
						<div className="text-xl font-bold tracking-tight">
							Portfolio<span className="text-purple-400">AI</span>
						</div>
						<p className="mt-1 text-xs text-white/40">Intelligent portfolio</p>
					</div>

					<nav className="space-y-2">
						{["Overview", "Portfolio", "AI Intelligence", "Signals", "Settings"].map(
							(item, index) => (
								<div
									key={item}
									className={`rounded-xl px-4 py-3 text-sm ${
										index === 0
											? "bg-white/10 text-white"
											: "text-white/50 hover:bg-white/5"
									}`}
								>
									{item}
								</div>
							),
						)}
					</nav>

					<div className="mt-auto pt-10">
						<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
							<p className="text-xs text-white/40">Wallet</p>
							<WalletButton compact />
						</div>
					</div>
				</aside>

				{/* Main workspace */}
				<section className="flex-1">
					{/* Header */}
					<header className="flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-10">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-white/30">
								Portfolio
							</p>
							<h1 className="mt-1 text-2xl font-semibold">Overview</h1>
						</div>

						<div className="flex items-center gap-3">
							<div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50">
								Solana
							</div>
							<WalletButton />
						</div>
					</header>

					{/* Dashboard */}
					<div className="p-6 md:p-10">
						<div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
							{/* Portfolio value */}
							<div className="lg:col-span-1">
								{/* PortfolioOverview component (demo data) */}
								{/* Replaced static placeholder with PortfolioOverview */}
								<PortfolioOverview />
							</div>

							{/* AI panel */}
							<div className="relative overflow-hidden rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 via-transparent to-white/[0.02] p-6">
								{/* AIInsights component (demo observations) */}
								<AIInsights />
							</div>
						</div>

						{/* Intelligence */}
						<div className="mt-6">
							<div className="rounded-3xl border border-white/10 bg-white/[0.025] p-8">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-white/40">AI Intelligence</p>
										<h2 className="mt-1 text-xl font-semibold">Nothing to analyze yet</h2>
									</div>
									<div className="h-12 w-12 rounded-full border border-purple-400/20 bg-purple-400/10" />
								</div>
								<p className="mt-6 max-w-2xl text-sm leading-6 text-white/35">
									Once your wallet is connected, Portfolio AI will monitor your portfolio and surface the most important things happening across your assets.
								</p>
							</div>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
