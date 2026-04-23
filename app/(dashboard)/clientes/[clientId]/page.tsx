"use client";

import ClienteDetalhePage from "@/views/ClienteDetalhe";

export default function ClienteDetalheRoute({ params }: { params: { clientId: string } }) {
  return <ClienteDetalhePage clientId={params.clientId} />;
}
