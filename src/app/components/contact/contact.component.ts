import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import emailjs from "@emailjs/browser";
import { environment } from "../../../environments/environment";

type SendState = "idle" | "loading" | "success" | "error";

@Component({
  selector: "app-contact",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
})
export class ContactComponent {
  sendState = signal<SendState>("idle");
  errorMessage = signal<string>("");

  form = { name: "", email: "", subject: "", message: "" };

  submitted() {
    return this.sendState() === "success";
  }

  isLoading() {
    return this.sendState() === "loading";
  }

  hasError() {
    return this.sendState() === "error";
  }

  async onSubmit() {
    if (this.sendState() === "loading") return;

    this.sendState.set("loading");
    this.errorMessage.set("");

    try {
      await emailjs.send(
        environment.emailjs.serviceId,
        environment.emailjs.templateId,
        {
          from_name: this.form.name,
          from_email: this.form.email,
          subject: this.form.subject,
          message: this.form.message,
        },
        environment.emailjs.publicKey,
      );

      this.sendState.set("success");
      this.form = { name: "", email: "", subject: "", message: "" };

      setTimeout(() => this.sendState.set("idle"), 4000);
    } catch (error: any) {
      console.error("EmailJS error:", error);
      this.errorMessage.set(
        error?.text ||
          "Erreur lors de l'envoi. Réessayez ou contactez-moi directement.",
      );
      this.sendState.set("error");

      setTimeout(() => this.sendState.set("idle"), 6000);
    }
  }
}
