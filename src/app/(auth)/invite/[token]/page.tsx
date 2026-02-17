import { AcceptInvitation } from "@/components/family/accept-invitation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptInvitation token={token} />;
}
