import { Component } from "@angular/core";

@Component({
  selector: "app-about",
  standalone: true,
  templateUrl: "./about.component.html",
  styleUrl: "./about.component.scss",
})
export class AboutComponent {
  cards = [
    {
      category: "Core_Expertise",
      title: "Front-End Angular",
      desc: "Composants, services, routing, formulaires réactifs. Architecture modulaire et scalable.",
      color: "var(--color-primary)",
    },
    {
      category: "Back_End",
      title: "Symfony / API Platform",
      desc: "APIs REST robustes, entités, contrôleurs. Architecture API-first.",
      color: "var(--color-secondary)",
    },
    {
      category: "Cloud_Infra",
      title: "AWS & DevOps",
      desc: "Déploiement cloud, CI/CD, infrastructure. Git Flow et méthodologie Agile.",
      color: "var(--color-tertiary)",
    },
    {
      category: "Background",
      title: "Vision Transversale",
      desc: "11 ans en assurance, 6 ans en audio. Adaptabilité, rigueur et communication.",
      color: "var(--color-primary)",
    },
  ];

  stats = [
    { value: "2023", label: "Début_Dev" },
    { value: "20+", label: "Ans_Pro" },
    { value: "3", label: "Vies_Pro" },
    { value: "∞", label: "Curiosité" },
  ];

  languages = [
    {
      name: "Anglais",
      level: "C2 Bilingue",
      pct: 95,
      color: "var(--color-primary)",
    },
    { name: "Allemand", level: "B2", pct: 65, color: "var(--color-secondary)" },
    { name: "Espagnol", level: "A2", pct: 25, color: "var(--color-tertiary)" },
  ];

  profilePic = "./assets/photoprofilpierre.jpg";
}
