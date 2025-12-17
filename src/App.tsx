import { Layout } from '@/components/Layout';
import { ChatArea } from '@/components/ChatArea';
import { SettingsModal } from '@/components/SettingsModal';

function App() {
  return (
    <>
      <Layout>
        <ChatArea />
      </Layout>
      <SettingsModal />
    </>
  )
}

export default App
