import { createNetworkConfig, SuiClientProvider, lightTheme, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getQueryClient } from './lib/query-client';
import { Footer } from './components/footer';
import { ToastProvider } from './components/ui/toast-provider';
import { Toaster } from './components/ui/toaster';
import Home from './pages/Home';
import Mint from './pages/Mint';
import Explore from './pages/Explore';
import MyNFTs from './pages/MyNFTs';
import Admin from './pages/Admin';
import './App.css';

// Config options for the networks you want to connect to
const { networkConfig } = createNetworkConfig({
  localnet: { url: getFullnodeUrl('localnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = getQueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork='testnet'>
        <WalletProvider theme={lightTheme}>
          <ToastProvider>
            <BrowserRouter>
              <div className="flex flex-col min-h-screen relative">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/mint" element={<Mint />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/my-nfts" element={<MyNFTs />} />
                  <Route path="/admin" element={<Admin />} />
                </Routes>
                <Footer />
              </div>
            </BrowserRouter>
            <Toaster />
          </ToastProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App
