import { etatJournee } from "@/app/actions-workflow";
import JourneeClient from "./JourneeClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// L'ÉCRAN DU QR — deux codes, deux usages
//
//   /journee/<jeton>  où <jeton> est le qr_journee d'un ouvrier
//                     → « ma journée » : tout son travail du jour,
//                       dans l'ordre fixé par l'admin
//
//   /journee/<jeton>  où <jeton> est son qr_entree
//                     → un seul bouton : pointer l'entrée ou la
//                       sortie. Rien d'autre.
//
// Le MÊME écran sert les deux : c'est le jeton qui décide, pas
// l'URL. Un ouvrier qui scanne le mauvais code ne se perd pas dans
// un menu — il voit ce que son code veut dire.
// ═══════════════════════════════════════════════════════════

export default async function JourneePage({ params }: { params: { token: string } }) {
  const etat = await etatJournee({ token: params.token });
  return <JourneeClient token={params.token} etat={etat} />;
}
