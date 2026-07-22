<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <AsciiLogo />
    </template>
  </DefaultTheme.Layout>
</template>

<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import AsciiLogo from "./AsciiLogo.vue";
</script>
