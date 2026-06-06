# MYC ChatGPT Bridge V2

Extensión Chrome MV3 para conectar tu webapp local (`localhost`) con una pestaña abierta de ChatGPT.

## Qué hace

- Envía prompts JSON desde tu app local hacia ChatGPT.
- Inserta el prompt automáticamente en el cuadro de ChatGPT.
- Tiene modo manual y modo auto-send.
- Mantiene una cola básica de prompts.
- Valida si la respuesta parece JSON válido.
- Devuelve la respuesta a tu app local mediante eventos del navegador.
- Incluye popup para ver estado, cola, errores y último resultado.

## Instalación

1. Descomprime este ZIP.
2. Abre Chrome.
3. Ve a `chrome://extensions`.
4. Activa `Developer mode`.
5. Click en `Load unpacked`.
6. Selecciona la carpeta `MYC-ChatGPT-Bridge-V2`.
7. Abre una pestaña en `https://chatgpt.com`.
8. Abre tu app local en `http://localhost:3000`.

## Uso básico desde tu app

```js
window.dispatchEvent(
  new CustomEvent("MYCBridgeSendPrompt", {
    detail: {
      jsonPrompt: {
        accion: "generar_apu",
        partida: "Muro de ladrillo King Kong",
        unidad: "m2"
      },
      metadata: {
        source: "myc-presupuestos"
      }
    }
  })
);

window.addEventListener("MYCBridgeResponse", (event) => {
  console.log("Respuesta desde ChatGPT:", event.detail);
});
```

## Helper opcional para Next.js

Incluí el archivo:

```txt
myc-bridge-client.js
```

Puedes copiarlo a tu proyecto como:

```txt
lib/myc-bridge-client.ts
```

Ejemplo:

```js
import { sendToMYCChatGPTBridge, onMYCBridgeResponse } from "@/lib/myc-bridge-client";

const requestId = sendToMYCChatGPTBridge({
  accion: "generar_apu",
  partida: "Concreto f'c=210 kg/cm2",
  unidad: "m3"
});

const unsubscribe = onMYCBridgeResponse((response) => {
  console.log(response.jsonValid, response.json, response.raw);
});
```

## Modos

### Manual

La extensión pega el prompt en ChatGPT, pero no lo envía.  
Útil para revisar antes de ejecutar.

### Auto enviar

La extensión pega el prompt, hace click en enviar, espera que termine y devuelve la respuesta.

## Advertencia

Esta extensión es para desarrollo local.  
La interfaz de ChatGPT puede cambiar y romper selectores DOM.

Para producción, usa API oficial.
