# Version Control (Git) 🎉

Welcome to **Acode Version Control (Git) Plugin**! 🚀

This plugin is a lightweight solution for those of you who love coding in Acode and need version control right in the editor. With this plugin, you can manage Git without having to switch between apps. 😎

#### 🆕 Update v1.0.1: Fix SAF URI and Termux Path Issues
#### 🆕 Update v1.0.2: You can now choose a folder location before cloning a repository.

## 🤔 How It Works

This plugin is built with [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) and leverages Acode's `fsOperation` API for a custom file system integration. Big thanks to the developers of isomorphic-git for making Git operations in JavaScript a reality. 🙌

---

## 🚧 Limitations

Okay, let’s be real—this plugin isn’t perfect. Here are some current limitations:

1. **Performance Issues**: It can be slow, especially for large repositories.
2. **Not Recommended for Big Repos**: If your repository is huge, you might want to use a dedicated Git client.

But i’m working on it! I’m exploring ways to improve performance and make it better. If you have ideas or contributions to make this plugin faster and more efficient, feel free to jump in.

## Images
<div style="display:flex;width:100%;overflow:scroll">
<img src="https://github.com/user-attachments/assets/18b9e64c-b45b-41e8-809b-3433f73ce894" width="50%">
<img src="https://github.com/user-attachments/assets/1e84577b-9ecb-4523-9e4e-cbf925dd0b56" width="50%" style="padding:10px">
<img src="https://github.com/user-attachments/assets/853364a1-afbd-4520-a2bb-b0816c13ab09" style="padding:10px">
<img src="https://github.com/user-attachments/assets/99a14d72-e50c-4031-9e3a-2531e61fe237" style="padding:10px">
</div>

## 🎯 Key Features

- **Clone**: Clone repositories directly to local system. Private repositories will require authentication. A prompt dialog will appear for you to enter your GitHub token, or you can set it in the plugin settings.
- **Pull & Push**: Synchronize your code.
- **Pull To & Push To**: Flexible for those who like to work with specific branches.
- **Remote**: Manage remote repositories.
- **Fetch**: Get updates from the remote without merging.
- **Branch Management**: Create, switch, and manage branches easily.
- **Config**: Set up your name, email, or other Git configurations.
- **Checkout**: Switch branches.
- **Commit**: Commit your changes with a message.
- **Status Files**: Check your file changes with the source control status feature.

## 📦 How to Install

1. **Download in Acode**: 
   - Open Acode.
   - Go to the settings/plugin menu, then select "Version Control (Git)".
   - Click download.

## 🤔 Questions or Issues?
If you have any questions, suggestions, or find a bug, just create an [Issue here](https://github.com/dikidjatar/acode-plugin-version-control).

---

## 💡 Contributing
Want to help make this plugin cooler? Fork this repo, add a feature, or fix a bug, then submit a Pull Request!

---

## 📝 Lisensi
This plugin is released under the MIT license. Feel free to use, modify, or contribute as needed. 👍