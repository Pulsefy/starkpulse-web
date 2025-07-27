import { HomeView } from "./home/home-view";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }];
}

export default function Home() {
  return <HomeView />;
}
