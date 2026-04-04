import { Component } from "@angular/core";

@Component({
  selector: "app-experience",
  standalone: true,
  templateUrl: "./experience.component.html",
  styleUrl: "./experience.component.scss",
})
export class ExperienceComponent {
  experiences = [
    {
      period: "SEPT. 2023 → AUJOURD'HUI",
      title: "Développeur Web Fullstack (Front orienté)",
      company: "Linkpart — Lyon",
      current: true,
      color: "var(--color-primary)",
      description:
        "Éditeur du logiciel Hub3E : logiciel entre ATS et CRM, dédiée aux centres de formation pour optimiser la mise en relation candidats/entreprises en alternance.",
      tasks: [
        "Développement et maintenance du front-end Angular (composants, services, routing, formulaires réactifs)",
        "Contribution au back-end Symfony avec API Platform (API REST, entités, controllers)",
        "Conception et consommation d'APIs REST en environnement API Platform",
        "Déploiement et gestion des clients sur la plateforme Hub3E",
        "Analyse des besoins clients et proposition de solutions techniques adaptées",
        "Collaboration en méthodologie Agile (sprints, code review, Git flow)",
      ],
      stack: [
        "Angular",
        "TypeScript",
        "Symfony",
        "API Platform",
        "PHP",
        "MySQL",
        "Git",
      ],
    },
    {
      period: "2023",
      title: "Développeur Web — Projets de formation",
      company: "Wild Code School",
      current: false,
      color: "var(--color-secondary)",
      description: null,
      tasks: [
        "Site vitrine festival musique — HTML, CSS, JS — équipe de 3",
        "Intranet d'entreprise — React.js, SCSS, APIs — équipe de 4",
        "Hackathon 24H — React.js + API — équipe de 3",
      ],
      stack: ["HTML", "CSS", "JavaScript", "React.js", "SCSS"],
    },
    {
      period: "2011 → 2022",
      title: "Gestionnaire Sinistre MRH",
      company: "MMA Assurances",
      current: false,
      color: "var(--color-tertiary)",
      description: null,
      tasks: [
        "Gestion des sinistres habitation et responsabilité civile",
        "Relation client & rebonds commerciaux",
      ],
      stack: [],
    },
    {
      period: "2005 → 2011",
      title: "Technicien Son",
      company: "Indépendant",
      current: false,
      color: "var(--color-text-dim)",
      description: null,
      tasks: [
        "Enregistrements & mixage studio",
        "Sonorisation d'événements & concerts",
        "Prises de son / tournages documentaires",
        "Postproduction",
      ],
      stack: [],
    },
  ];

  education = [
    {
      year: "2023",
      school: "Wild Code School - Lyon",
      degree: "Formation Développeur Web & Web Mobile",
    },
    {
      year: "2005",
      school: "EMC - Paris",
      degree: "Diplôme Technicien Son Studio & Post-production",
    },
    {
      year: "2003",
      school: "Université Paris Sorbonne Nouvelle",
      degree: "DEUG Langues Étrangères Appliquées — Anglais / Allemand",
    },
  ];

  interests = [
    {
      icon: "music_note_2",
      label:
        "Batteur semi-professionnel (25 ans) — réseaux sociaux, événements, contenus visuels",
    },
    { icon: "groups", label: "Président d'association (Loi 1901)" },
    { icon: "movie", label: "Cinéma & Séries" },
  ];
}
