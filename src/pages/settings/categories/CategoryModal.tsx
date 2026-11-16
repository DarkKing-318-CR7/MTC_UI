import { useEffect } from "react";
import { Form, Input } from "antd";
import { CircleAlert } from "lucide-react";

import AppModal from "../../../components/common/AppModal";
import AppForm from "../../../components/common/AppForm";
import AppInput from "../../../components/common/AppInput";
import AppButton from "../../../components/common/AppButton";

import type { Category, CategoryFormValues } from "../types/categories.types";

import "./CategoryModal.css";

export type CategoryModalMode = "create" | "edit" | "view";

interface CategoryModalProps {
  open: boolean;
  mode: CategoryModalMode;
  category: Category | null;
  categories: Category[];
  onSave: (values: CategoryFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const modalTitles: Record<CategoryModalMode, string> = {
  create: "Thêm mới lĩnh vực",
  edit: "Cập nhật lĩnh vực",
  view: "Thông tin lĩnh vực",
};

function CategoryModal({
  open,
  mode,
  category,
  categories,
  onSave,
  onCancel,
}: CategoryModalProps) {
  const [form] = Form.useForm<CategoryFormValues>();
  const nameValue = Form.useWatch("name", form);

  const isViewMode = mode === "view";

  const normalizedName = String(nameValue ?? "")
    .trim()
    .toLowerCase();

  const isDuplicateName =
    !isViewMode &&
    normalizedName.length > 0 &&
    categories.some(
      (item) =>
        item.name.trim().toLowerCase() === normalizedName &&
        item.id !== category?.id,
    );

  useEffect(() => {
    if (!open) return;

    form.resetFields();

    if (category) {
      form.setFieldsValue({
        name: category.name,
        description: category.description ?? "",
      });
    }
  }, [open, category, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const name = values.name.trim();
      const description = values.description?.trim() ?? "";

      const duplicate = categories.some(
        (item) =>
          item.name.trim().toLowerCase() === name.toLowerCase() &&
          item.id !== category?.id,
      );

      if (duplicate) {
        form.setFields([
          {
            name: "name",
            errors: ["Tên lĩnh vực đã tồn tại trên hệ thống"],
          },
        ]);
        return;
      }

      await onSave({ name, description });
    } catch {
      return;
    }
  };

  return (
    <AppModal
      open={open}
      title={null}
      width={700}
      onCancel={onCancel}
      className="category-modal"
      footer={
        <div className="category-modal__footer">
          {isViewMode ? (
            <AppButton
              variant="outline"
              width={158}
              height={44}
              onClick={onCancel}>
              Đóng
            </AppButton>
          ) : (
            <>
              <AppButton
                variant="outline"
                width={158}
                height={44}
                onClick={onCancel}>
                Hủy
              </AppButton>

              <AppButton
                variant="primary"
                width={158}
                height={44}
                onClick={handleSave}>
                Lưu
              </AppButton>
            </>
          )}
        </div>
      }>
      <h2 className="category-modal__title">{modalTitles[mode]}</h2>

      <AppForm<CategoryFormValues>
        form={form}
        layout="vertical"
        requiredMark={!isViewMode}
        className="category-modal__form">
        <Form.Item
          name="name"
          label="Tên lĩnh vực"
          rules={
            isViewMode
              ? []
              : [
                  {
                    required: true,
                    whitespace: true,
                    message: "Vui lòng nhập tên lĩnh vực",
                  },
                  {
                    max: 255,
                    message: "Tên lĩnh vực tối đa 255 ký tự",
                  },
                  {
                    validator: async (_, value: string | undefined) => {
                      const name = value?.trim().toLowerCase();

                      if (!name) return;

                      const exists = categories.some(
                        (item) =>
                          item.name.trim().toLowerCase() === name &&
                          item.id !== category?.id,
                      );

                      if (exists) {
                        throw new Error("Tên lĩnh vực đã tồn tại trên hệ thống");
                      }
                    },
                  },
                ]
          }
          help={
            isDuplicateName ? (
              <div className="category-modal__duplicate">
                <CircleAlert size={20} />
                <span>Tên lĩnh vực đã tồn tại trên hệ thống</span>
              </div>
            ) : undefined
          }
          validateStatus={isDuplicateName ? "warning" : undefined}>
          <AppInput
            width="100%"
            placeholder="Nhập tên lĩnh vực"
            readOnly={isViewMode}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label="Mô tả"
          rules={
            isViewMode
              ? []
              : [
                  {
                    max: 500,
                    message: "Mô tả tối đa 500 ký tự",
                  },
                ]
          }>
          <Input.TextArea rows={4} maxLength={500} readOnly={isViewMode} />
        </Form.Item>
      </AppForm>

      {!isViewMode && (
        <p className="category-modal__note">
          <span>*</span> là những trường thông tin bắt buộc
        </p>
      )}
    </AppModal>
  );
}

export default CategoryModal;
