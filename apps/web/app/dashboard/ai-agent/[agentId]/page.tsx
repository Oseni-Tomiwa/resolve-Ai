import { AgentEditor } from '../agent-editor';
export default async function EditAgentPage({ params }: { params: Promise<{ agentId: string }> }) { const { agentId } = await params; return <AgentEditor agentId={agentId} />; }
