/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { useState } from "react";
import { Text } from "@theme-ui/components";
import { Perform } from "../../../common/dialog-controller";
import Dialog from "../dialog";
import { steps } from "./steps";
import { AuthenticatorType } from "./types";

type RecoveryCodesDialogProps = {
  onClose: Perform;
  primaryMethod: AuthenticatorType;
};

export default function RecoveryCodesDialog(props: RecoveryCodesDialogProps) {
  const { onClose, primaryMethod } = props;
  const [error, setError] = useState<string>();
  const step = steps.recoveryCodes(primaryMethod);

  return (
    <Dialog
      isOpen={true}
      title={step.title}
      description={step.description}
      width={500}
      positiveButton={{
        text: "Okay",
        onClick: onClose
      }}
    >
      {step.component && (
        <step.component onNext={() => {}} onError={setError} />
      )}
      {error && (
        <Text variant={"error"} bg="errorBg" p={1} mt={2}>
          {error}
        </Text>
      )}
    </Dialog>
  );
}
