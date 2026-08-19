import { Hero } from "@/components/Hero";
import { EcosystemShowcase } from "@/components/EcosystemShowcase";
import { EngineeringPrinciples } from "@/components/EngineeringPrinciples";
import { FounderProfile } from "@/components/FounderProfile";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <EcosystemShowcase />
      <EngineeringPrinciples />
      <FounderProfile />
    </div>
  );
}
