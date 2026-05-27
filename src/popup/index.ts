import { APP_NAME } from "../shared";

const statusElement = document.querySelector<HTMLParagraphElement>("#popup-status");

if (statusElement) {
  statusElement.dataset.app = APP_NAME;
}
