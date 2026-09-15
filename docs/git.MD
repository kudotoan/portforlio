
git init
# Tạo Git repository

git clone <url>
# Tải repository về máy

git status
# Xem trạng thái file

git add <file>
# Đưa 1 file vào staging

git add .
# Đưa toàn bộ thay đổi vào staging

git commit -m "message"
# Tạo commit

git log
# Xem lịch sử commit

git log --oneline
# Xem lịch sử commit dạng ngắn

git log --oneline --graph --all
# Xem lịch sử dạng cây

git show <commit>
# Xem chi tiết một commit

git diff
# Xem code đã sửa nhưng chưa add

git diff --staged
# Xem code đã add nhưng chưa commit

git branch
# Xem các branch

git branch <name>
# Tạo branch mới

git switch <branch>
# Chuyển sang branch khác

git switch -c <branch>
# Tạo branch mới và chuyển sang luôn

git branch -d <branch>
# Xóa branch

git remote -v
# Xem remote repository

git remote add origin <url>
# Thêm remote

git fetch
# Tải thông tin mới từ remote, chưa nhập vào code hiện tại

git pull
# Tải và nhập code mới từ remote

git push
# Đẩy commit lên remote

git push -u origin <branch>
# Push branch lần đầu và đặt upstream

git merge <branch>
# Gộp branch vào branch hiện tại

git merge --abort
# Hủy merge đang thực hiện

git rebase <branch>
# Đặt commit branch hiện tại lên trên branch khác

git rebase --abort
# Hủy rebase

git restore <file>
# Bỏ thay đổi chưa add của file

git restore .
# Bỏ toàn bộ thay đổi chưa add

git restore --staged <file>
# Bỏ file khỏi staging

git reset --soft HEAD~1
# Xóa commit gần nhất nhưng giữ staging

git reset HEAD~1
# Xóa commit gần nhất, giữ code nhưng bỏ staging

git reset --hard HEAD~1
# Xóa commit gần nhất và xóa luôn code thay đổi

git reset --hard <commit>
# Quay repository về commit cụ thể

git revert <commit>
# Tạo commit mới để đảo ngược một commit cũ

git stash
# Cất tạm code đang sửa

git stash list
# Xem danh sách stash

git stash pop
# Lấy code stash gần nhất ra và xóa stash đó

git stash apply
# Lấy code stash ra nhưng vẫn giữ stash

git reflog
# Xem lịch sử di chuyển HEAD, dùng để cứu commit bị mất

git checkout <commit>
# Chuyển tạm sang commit cũ

git switch --detach <commit>
# Cách mới để xem commit cũ

git cherry-pick <commit>
# Lấy một commit cụ thể từ branch khác

git tag
# Xem tag

git tag <name>
# Tạo tag

git rm <file>
# Xóa file khỏi Git và ổ đĩa

git rm --cached <file>
# Ngừng theo dõi file nhưng vẫn giữ file

git mv <old> <new>
# Đổi tên hoặc di chuyển file

git clean -n
# Xem file untracked nào sẽ bị xóa

git clean -f
# Xóa file untracked

git blame <file>
# Xem commit nào sửa từng dòng

git config --list
# Xem cấu hình Git

git config --global user.name "Tên"
# Đặt tên người commit

git config --global user.email "email"
# Đặt email người commit

git help <command>
# Xem hướng dẫn một lệnh

git help -a
# Xem tất cả lệnh Git