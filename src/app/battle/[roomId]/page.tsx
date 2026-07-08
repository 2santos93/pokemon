import { BattleRoom } from "@/components/battle/battle-room";

interface BattleRoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function BattleRoomPage({ params }: BattleRoomPageProps) {
  const { roomId } = await params;
  return <BattleRoom roomId={roomId} />;
}
