import { Component } from "@angular/core";

@Component({
  selector: "app-projects",
  standalone: true,
  templateUrl: "./projects.component.html",
  styleUrl: "./projects.component.scss",
})
export class ProjectsComponent {
  projects = [
    {
      featured: true,
      type: "PROD · 2023–PRÉSENT",
      title: "Hub3E — Linkpart",
      desc: "Plateforme SaaS entre ATS et CRM pour les centres de formation. Gestion de l'alternance et mise en relation candidats/entreprises.",
      tags: [
        "Angular",
        "TypeScript",
        "Symfony",
        "API Platform",
        "AWS",
        "MySQL",
      ],
      github: null,
      live: null,
    },
    {
      featured: false,
      type: "FORMATION · 2023",
      title: "Site Festival Musique",
      desc: "Site vitrine pour un festival de musique. Projet en équipe de 3, focus sur l'expérience utilisateur et l'animation CSS.",
      tags: ["HTML", "CSS", "JavaScript"],
      github: "https://github.com",
      live: null,
    },
    {
      featured: false,
      type: "FORMATION · 2023",
      title: "Intranet Entreprise",
      desc: "Application intranet avec authentification, tableau de bord et gestion des ressources internes. Consommation d'APIs tierces.",
      tags: ["React.js", "SCSS", "APIs REST"],
      github: "https://github.com",
      live: null,
    },
    {
      featured: false,
      type: "HACKATHON · 2023",
      title: "Hackathon 24H",
      desc: "Projet réalisé en 24h en équipe de 3. Conception, développement et présentation d'une application React consommant une API publique.",
      tags: ["React.js", "API REST"],
      github: "https://github.com",
      live: null,
    },
  ];
}
